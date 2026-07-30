import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

// Feature contract — must match ml-service/model.py FEATURES.
export interface FraudFeatures {
  duplicate_title: number;
  duplicate_parcel: number;
  seller_blacklisted: number;
  doc_hash_collision: number;
  expired_docs: number;
  missing_title_deed: number;
  listing_velocity: number;
  price_below_market_ratio: number;
  owner_mismatch: number;
}

export interface MlScore {
  model: string;
  probability: number;
  riskScore: number;
  band: string;
  topContributors: { feature: string; contribution: number; direction: string }[];
}

// Calls the Python ML microservice. Returns null on any failure so the caller
// can fall back to the rule-based engine (graceful degradation).
export async function scoreWithMl(features: FraudFeatures): Promise<MlScore | null> {
  if (!env.ml.enabled) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ml.timeoutMs);
    const res = await fetch(`${env.ml.url}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`ML service responded ${res.status}`);
    return (await res.json()) as MlScore;
  } catch (err) {
    logger.warn('ML service unavailable — falling back to rule engine', { err: (err as Error).message });
    return null;
  }
}
