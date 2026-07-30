import { prisma } from '../lib/prisma.js';
import { FraudType, FraudSeverity, ParcelStatus } from '../constants/index.js';
import { notifyRole } from './notification.service.js';
import { logger } from '../lib/logger.js';
import { scoreWithMl, type FraudFeatures } from './ml.client.js';

/**
 * LandGuard Fraud Detection Engine
 * ---------------------------------
 * Two-tier design:
 *   1. A rule layer runs a battery of explainable checks over a parcel and its
 *      documents, emitting weighted FraudFlags (the human-readable evidence).
 *   2. The engineered feature vector from those same checks is sent to the Python
 *      ML microservice (logistic-regression classifier) which returns a calibrated
 *      fraud probability → the authoritative 0-100 risk score.
 *
 * If the ML service is unavailable the rule layer's weighted sum is used instead,
 * so scoring degrades gracefully and the platform never blocks on the model.
 *
 * Detects: duplicate parcel numbers, duplicate title deeds, duplicate ownership,
 * fake/tampered documents (hash collisions across different owners), blacklisted
 * sellers, expired documents, and suspicious rapid-listing activity.
 */

interface FraudResult {
  riskScore: number; // rule-based aggregate (fallback / evidence weight)
  flags: Array<{ type: string; severity: string; score: number; description: string; documentId?: string }>;
  features: FraudFeatures;
}

const WEIGHTS: Record<string, number> = {
  [FraudType.DUPLICATE_PARCEL]: 40,
  [FraudType.DUPLICATE_TITLE]: 45,
  [FraudType.DUPLICATE_OWNERSHIP]: 35,
  [FraudType.FAKE_DOCUMENT]: 50,
  [FraudType.BLACKLISTED_USER]: 60,
  [FraudType.EXPIRED_DOCUMENT]: 20,
  [FraudType.SUSPICIOUS_ACTIVITY]: 15,
};

function severityFor(score: number): string {
  if (score >= 60) return FraudSeverity.CRITICAL;
  if (score >= 40) return FraudSeverity.HIGH;
  if (score >= 20) return FraudSeverity.MEDIUM;
  return FraudSeverity.LOW;
}

// Heuristic "AI" document-authenticity score (0-1, higher = more likely genuine).
// Placeholder for an ML model; uses hash entropy + metadata completeness as signals.
function scoreDocumentAuthenticity(doc: { fileHash: string; expiryDate: Date | null; type: string }): number {
  let score = 0.85;
  const uniqueChars = new Set(doc.fileHash).size;
  if (uniqueChars < 8) score -= 0.4; // low-entropy hash → likely fabricated/blank file
  if (!doc.expiryDate && ['LAND_SEARCH', 'RATES_CLEARANCE'].includes(doc.type)) score -= 0.15;
  return Math.max(0, Math.min(1, score));
}

export async function analyzeParcel(parcelId: string): Promise<FraudResult> {
  const parcel = await prisma.landParcel.findUnique({
    where: { id: parcelId },
    include: { documents: true, seller: true },
  });
  if (!parcel) return { riskScore: 0, flags: [], features: emptyFeatures() };

  const flags: FraudResult['flags'] = [];
  let docCollisions = 0;
  let expiredDocs = 0;
  const push = (type: string, description: string, documentId?: string) => {
    const score = WEIGHTS[type] ?? 10;
    flags.push({ type, severity: severityFor(score), score, description, documentId });
  };

  // 1. Duplicate parcel number (another parcel record shares this identifier)
  const dupParcel = await prisma.landParcel.count({
    where: { parcelNumber: parcel.parcelNumber, id: { not: parcel.id } },
  });
  if (dupParcel > 0) push(FraudType.DUPLICATE_PARCEL, `Parcel number ${parcel.parcelNumber} is registered on ${dupParcel} other listing(s).`);

  // 2. Duplicate title deed number
  const dupTitle = await prisma.landParcel.count({
    where: { titleDeedNumber: parcel.titleDeedNumber, id: { not: parcel.id } },
  });
  if (dupTitle > 0) push(FraudType.DUPLICATE_TITLE, `Title deed ${parcel.titleDeedNumber} appears on ${dupTitle} other listing(s).`);

  // 3. Blacklisted seller
  if (parcel.seller.isBlacklisted) {
    push(FraudType.BLACKLISTED_USER, `Seller is blacklisted: ${parcel.seller.blacklistReason ?? 'flagged for prior fraud'}.`);
  }

  // 4. Document-level checks: tamper/duplication (same hash under a different seller) + authenticity + expiry
  for (const doc of parcel.documents) {
    const collision = await prisma.document.findFirst({
      where: { fileHash: doc.fileHash, id: { not: doc.id }, parcel: { sellerId: { not: parcel.sellerId } } },
      include: { parcel: true },
    });
    if (collision) {
      docCollisions += 1;
      push(FraudType.FAKE_DOCUMENT, `Document "${doc.fileName}" is byte-identical to a document filed by a different seller (possible forgery/reuse).`, doc.id);
    }

    const authenticity = scoreDocumentAuthenticity(doc);
    if (authenticity < 0.5) {
      push(FraudType.FAKE_DOCUMENT, `Document "${doc.fileName}" failed authenticity heuristics (score ${authenticity.toFixed(2)}).`, doc.id);
    }

    if (doc.expiryDate && doc.expiryDate < new Date()) {
      expiredDocs += 1;
      push(FraudType.EXPIRED_DOCUMENT, `Document "${doc.fileName}" expired on ${doc.expiryDate.toISOString().slice(0, 10)}.`, doc.id);
    }
  }

  // 5. Duplicate ownership — seller listing land whose verified current owner is someone else
  if (parcel.currentOwnerId && parcel.currentOwnerId !== parcel.sellerId) {
    push(FraudType.DUPLICATE_OWNERSHIP, `Seller does not match the recorded current owner of this parcel.`);
  }

  // 6. Suspicious activity — seller floods the platform with listings in a short window
  const recentCount = await prisma.landParcel.count({
    where: { sellerId: parcel.sellerId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (recentCount >= 5) {
    push(FraudType.SUSPICIOUS_ACTIVITY, `Seller created ${recentCount} listings in the last 24h — unusually high velocity.`);
  }

  // Market-price deviation: how far below the county's average KES/acre this parcel
  // is priced (a steep discount is a classic bait signal). 0 when no comparables.
  const priceBelowMarketRatio = await priceBelowMarket(parcel.county, parcel.price / parcel.sizeAcres, parcel.id);

  // Engineered feature vector consumed by the ML classifier.
  const features: FraudFeatures = {
    duplicate_title: dupTitle,
    duplicate_parcel: dupParcel,
    seller_blacklisted: parcel.seller.isBlacklisted ? 1 : 0,
    doc_hash_collision: docCollisions,
    expired_docs: expiredDocs,
    missing_title_deed: parcel.documents.some((d) => d.type === 'TITLE_DEED') ? 0 : 1,
    listing_velocity: recentCount,
    price_below_market_ratio: priceBelowMarketRatio,
    owner_mismatch: parcel.currentOwnerId && parcel.currentOwnerId !== parcel.sellerId ? 1 : 0,
  };

  // Rule-based aggregate (used as fallback / evidence weight; capped at 100)
  const riskScore = Math.min(100, flags.reduce((sum, f) => sum + f.score, 0));
  return { riskScore, flags, features };
}

function emptyFeatures(): FraudFeatures {
  return {
    duplicate_title: 0, duplicate_parcel: 0, seller_blacklisted: 0, doc_hash_collision: 0,
    expired_docs: 0, missing_title_deed: 0, listing_velocity: 0, price_below_market_ratio: 0, owner_mismatch: 0,
  };
}

async function priceBelowMarket(county: string, pricePerAcre: number, excludeId: string): Promise<number> {
  const comps = await prisma.landParcel.findMany({
    where: { county, id: { not: excludeId }, status: { in: [ParcelStatus.LISTED, ParcelStatus.VERIFIED, ParcelStatus.SOLD] } },
    select: { price: true, sizeAcres: true },
  });
  if (comps.length === 0) return 0;
  const market = comps.reduce((s, c) => s + c.price / c.sizeAcres, 0) / comps.length;
  if (market <= 0) return 0;
  return Math.max(0, Math.min(1, (market - pricePerAcre) / market));
}

// Runs analysis, asks the ML model to score, persists flags + risk score,
// auto-flags high-risk parcels, and alerts admins/officers.
export async function runAndPersistFraudCheck(parcelId: string) {
  const { riskScore: ruleScore, flags, features } = await analyzeParcel(parcelId);

  // Authoritative score from the ML classifier; fall back to the rule score if the
  // service is down. A duplicate/blacklist case scores high under either path.
  const ml = await scoreWithMl(features);
  const engine = ml ? 'ml' : 'rules';
  const riskScore = ml ? ml.riskScore : ruleScore;

  await prisma.$transaction(async (tx) => {
    // clear previous unresolved auto-flags for a clean re-scan
    await tx.fraudFlag.deleteMany({ where: { parcelId, resolved: false } });
    for (const f of flags) {
      await tx.fraudFlag.create({
        data: {
          parcelId,
          documentId: f.documentId,
          type: f.type,
          severity: f.severity,
          score: f.score,
          description: f.description,
        },
      });
    }
    const parcel = await tx.landParcel.findUnique({ where: { id: parcelId } });
    const shouldFlag = riskScore >= 60 && parcel && ![ParcelStatus.SOLD].includes(parcel.status as any);
    await tx.landParcel.update({
      where: { id: parcelId },
      data: { riskScore, ...(shouldFlag ? { status: ParcelStatus.FLAGGED } : {}) },
    });
  });

  if (riskScore >= 60) {
    logger.warn('High-risk parcel flagged', { parcelId, riskScore, engine });
    await notifyRole('ADMIN', {
      title: '🚨 High-risk parcel detected',
      body: `Parcel ${parcelId} scored ${riskScore}/100 (${engine}) and was auto-flagged for review.`,
      type: 'FRAUD_ALERT',
      link: `/dashboard/fraud`,
    });
  }

  return { riskScore, ruleScore, engine, flags, ml };
}
