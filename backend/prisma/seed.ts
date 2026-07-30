import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const PASSWORD = 'Password123!';

async function main() {
  console.log('🌱 Seeding LandGuard Kenya…');

  // Clean (order matters for FKs)
  await prisma.auditLog.deleteMany();
  await prisma.fraudFlag.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.qrCode.deleteMany();
  await prisma.ownershipHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.verificationRecord.deleteMany();
  await prisma.document.deleteMany();
  await prisma.message.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.siteVisit.deleteMany();
  await prisma.landParcel.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  // ─── Roles ─────────────────────────────────────────────────────────────────
  const roleDefs = [
    { name: 'ADMIN', description: 'System administrator with full access', permissions: ['*'] },
    { name: 'GOVERNMENT_OFFICER', description: 'Ministry of Lands verification officer', permissions: ['verification:government', 'transaction:approve'] },
    { name: 'SURVEYOR', description: 'Licensed land surveyor', permissions: ['verification:survey', 'sitevisit:complete'] },
    { name: 'SELLER', description: 'Land owner listing parcels for sale', permissions: ['parcel:create', 'document:upload'] },
    { name: 'BUYER', description: 'Prospective land buyer', permissions: ['parcel:search', 'transaction:create'] },
  ];
  for (const r of roleDefs) {
    await prisma.role.create({ data: { name: r.name, description: r.description, permissions: JSON.stringify(r.permissions) } });
  }

  const hash = await bcrypt.hash(PASSWORD, 12);
  const mkUser = (over: any) => prisma.user.create({ data: { passwordHash: hash, status: 'ACTIVE', ...over } });

  // ─── Users ─────────────────────────────────────────────────────────────────
  const admin = await mkUser({ email: 'admin@landguard.co.ke', phone: '254700000001', firstName: 'Amina', lastName: 'Otieno', role: 'ADMIN', nationalId: '10000001' });
  const officer = await mkUser({ email: 'officer@landguard.co.ke', phone: '254700000002', firstName: 'James', lastName: 'Kariuki', role: 'GOVERNMENT_OFFICER', nationalId: '10000002' });
  const surveyor = await mkUser({ email: 'surveyor@landguard.co.ke', phone: '254700000003', firstName: 'Naomi', lastName: 'Wanjiru', role: 'SURVEYOR', nationalId: '10000003' });
  const seller = await mkUser({ email: 'seller@landguard.co.ke', phone: '254700000004', firstName: 'Peter', lastName: 'Mwangi', role: 'SELLER', nationalId: '10000004' });
  const seller2 = await mkUser({ email: 'seller2@landguard.co.ke', phone: '254700000006', firstName: 'Grace', lastName: 'Achieng', role: 'SELLER', nationalId: '10000006' });
  const buyer = await mkUser({ email: 'buyer@landguard.co.ke', phone: '254700000005', firstName: 'David', lastName: 'Kiptoo', role: 'BUYER', nationalId: '10000005' });
  const fraudster = await mkUser({ email: 'blacklisted@landguard.co.ke', phone: '254700000009', firstName: 'Victor', lastName: 'Odhiambo', role: 'SELLER', nationalId: '10000009', isBlacklisted: true, blacklistReason: 'Previously filed forged title deeds' });

  // ─── Helper to create a parcel with docs + verification records ─────────────
  async function makeParcel(opts: any) {
    const parcel = await prisma.landParcel.create({
      data: {
        parcelNumber: opts.parcelNumber, titleDeedNumber: opts.titleDeedNumber, county: opts.county,
        subCounty: opts.subCounty, locality: opts.locality, sizeAcres: opts.sizeAcres, landUse: opts.landUse,
        price: opts.price, description: opts.description, latitude: opts.latitude, longitude: opts.longitude,
        status: opts.status, sellerId: opts.sellerId, currentOwnerId: opts.ownerId ?? opts.sellerId,
        featuredImage: opts.featuredImage, riskScore: opts.riskScore ?? 0,
      },
    });
    await prisma.document.create({
      data: { parcelId: parcel.id, type: 'TITLE_DEED', fileName: `title-${opts.parcelNumber}.pdf`, fileUrl: `local://docs/title-${parcel.id}.pdf`, fileHash: opts.titleHash ?? sha256(opts.titleDeedNumber + opts.sellerId), status: opts.docStatus ?? 'PENDING', uploadedById: opts.sellerId },
    });
    return parcel;
  }

  // Fully verified & listed parcels
  const p1 = await makeParcel({ parcelNumber: 'NAIROBI/KAREN/BLK12/451', titleDeedNumber: 'TD-NRB-2021-00451', county: 'Nairobi', subCounty: 'Langata', locality: 'Karen', sizeAcres: 0.5, landUse: 'RESIDENTIAL', price: 25_000_000, description: 'Prime half-acre residential plot in Karen, serviced with water and electricity, ready title.', latitude: -1.3197, longitude: 36.7062, status: 'LISTED', sellerId: seller.id, docStatus: 'VERIFIED', featuredImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800' });
  const p2 = await makeParcel({ parcelNumber: 'KIAMBU/RUIRU/BLK4/2210', titleDeedNumber: 'TD-KMB-2020-02210', county: 'Kiambu', subCounty: 'Ruiru', locality: 'Membley', sizeAcres: 0.25, landUse: 'RESIDENTIAL', price: 6_500_000, description: 'Quarter-acre plot in a gated community, tarmac access, clean title, ideal for a family home.', latitude: -1.1489, longitude: 36.9581, status: 'LISTED', sellerId: seller2.id, docStatus: 'VERIFIED', featuredImage: 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800' });
  const p3 = await makeParcel({ parcelNumber: 'NAKURU/GILGIL/BLK9/88', titleDeedNumber: 'TD-NKR-2019-00088', county: 'Nakuru', subCounty: 'Gilgil', locality: 'Gilgil', sizeAcres: 5, landUse: 'AGRICULTURAL', price: 4_000_000, description: 'Five-acre fertile agricultural land near Gilgil, suitable for horticulture, borehole present.', latitude: -0.4936, longitude: 36.3169, status: 'LISTED', sellerId: seller.id, docStatus: 'VERIFIED', featuredImage: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800' });

  // In-workflow parcels (for reviewer queues)
  const p4 = await makeParcel({
    parcelNumber: 'MOMBASA/NYALI/BLK7/33', titleDeedNumber: 'TD-MSA-2022-00033', county: 'Mombasa', subCounty: 'Nyali', locality: 'Nyali', sizeAcres: 0.3, landUse: 'COMMERCIAL', price: 18_000_000, description: 'Commercial plot near Nyali cinemax, high-traffic location, approved for mixed use.', latitude: -4.0169, longitude: 39.7002, status: 'PENDING_ADMIN', sellerId: seller.id,
    featuredImage: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800'
  });
  await prisma.verificationRecord.create({ data: { parcelId: p4.id, stage: 'ADMIN_REVIEW', status: 'PENDING' } });

  const p5 = await makeParcel({
    parcelNumber: 'MACHAKOS/MAVOKO/BLK2/900', titleDeedNumber: 'TD-MCK-2023-00900', county: 'Machakos', subCounty: 'Mavoko', locality: 'Syokimau', sizeAcres: 0.125, landUse: 'RESIDENTIAL', price: 3_200_000, description: 'Eighth-acre plot in Syokimau, walking distance to the SGR station, ready for development.', latitude: -1.3667, longitude: 36.9500, status: 'PENDING_GOVERNMENT', sellerId: seller2.id, docStatus: 'VERIFIED',
    featuredImage: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800'
  });
  await prisma.verificationRecord.create({ data: { parcelId: p5.id, stage: 'ADMIN_REVIEW', status: 'APPROVED', reviewerId: admin.id, decidedAt: new Date() } });
  await prisma.verificationRecord.create({ data: { parcelId: p5.id, stage: 'GOVERNMENT_VERIFICATION', status: 'PENDING' } });

  const p6 = await makeParcel({
    parcelNumber: 'KAJIADO/KITENGELA/BLK5/1200', titleDeedNumber: 'TD-KJD-2023-01200', county: 'Kajiado', subCounty: 'Kitengela', locality: 'Kitengela', sizeAcres: 1, landUse: 'RESIDENTIAL', price: 5_000_000, description: 'One-acre plot in fast-growing Kitengela, red-soil, ideal for residential subdivision.', latitude: -1.4750, longitude: 36.9600, status: 'PENDING_SURVEY', sellerId: seller.id, docStatus: 'VERIFIED',
    featuredImage: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800'
  });
  await prisma.verificationRecord.create({ data: { parcelId: p6.id, stage: 'ADMIN_REVIEW', status: 'APPROVED', reviewerId: admin.id, decidedAt: new Date() } });
  await prisma.verificationRecord.create({ data: { parcelId: p6.id, stage: 'GOVERNMENT_VERIFICATION', status: 'APPROVED', reviewerId: officer.id, decidedAt: new Date() } });
  await prisma.verificationRecord.create({ data: { parcelId: p6.id, stage: 'SURVEY_APPROVAL', status: 'PENDING' } });

  // Fraud demo: blacklisted seller + duplicate title deed of p1
  const pFraud = await makeParcel({
    parcelNumber: 'NAIROBI/KAREN/BLK12/451-DUP', titleDeedNumber: 'TD-NRB-2021-00451', county: 'Nairobi', subCounty: 'Langata', locality: 'Karen', sizeAcres: 0.5, landUse: 'RESIDENTIAL', price: 9_000_000, description: 'Suspiciously cheap Karen plot — reuses an existing title deed number.', status: 'DRAFT', sellerId: fraudster.id,
    featuredImage: 'https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800'
  });

  // Draft awaiting seller submission
  await makeParcel({
    parcelNumber: 'KISUMU/KISUMUCENTRAL/BLK3/77', titleDeedNumber: 'TD-KSM-2024-00077', county: 'Kisumu', subCounty: 'Kisumu Central', locality: 'Milimani', sizeAcres: 0.25, landUse: 'RESIDENTIAL', price: 4_500_000, description: 'Quarter-acre in Kisumu Milimani, mature neighbourhood, quiet street.', status: 'DRAFT', sellerId: seller.id,
    featuredImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'
  });

  // ─── A completed sale (ownership history + certificate) ──────────────────────
  const soldParcel = await makeParcel({ parcelNumber: 'NAIROBI/RUAI/BLK1/1500', titleDeedNumber: 'TD-NRB-2020-01500', county: 'Nairobi', subCounty: 'Embakasi', locality: 'Ruai', sizeAcres: 0.125, landUse: 'RESIDENTIAL', price: 2_800_000, description: 'Affordable eighth-acre plot in Ruai with ready title, sold via LandGuard.', status: 'SOLD', sellerId: seller2.id, ownerId: buyer.id, docStatus: 'VERIFIED' });
  const soldTx = await prisma.transaction.create({ data: { parcelId: soldParcel.id, buyerId: buyer.id, sellerId: seller2.id, offerAmount: 2_750_000, status: 'COMPLETED', govApprovedById: officer.id } });
  await prisma.payment.create({ data: { transactionId: soldTx.id, amount: 2_750_000, method: 'MPESA', status: 'SUCCESS', phoneNumber: '254700000005', providerRef: 'ws_CO_DEMO123' } });
  await prisma.ownershipHistory.create({ data: { parcelId: soldParcel.id, previousOwnerId: seller2.id, newOwnerId: buyer.id, transactionId: soldTx.id, transferType: 'SALE' } });
  // Sign the demo certificate QR payload exactly like qr.service.ts does, so the
  // public /verify page validates it (payload without sig => "possible forgery").
  const certQrBody = { v: 1, type: 'CERTIFICATE', code: 'demo-cert-qr-0001', parcelId: soldParcel.id, certificateNumber: 'LG-CERT-2026-DEMO0001', issuedAt: new Date().toISOString() };
  const certQrSig = crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret').update(JSON.stringify(certQrBody)).digest('hex');
  const certPayload = JSON.stringify({ certNumber: 'LG-CERT-2026-DEMO0001', parcelId: soldParcel.id, ownerId: buyer.id });
  const certSig = crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret').update(certPayload).digest('hex');
  const certQr = await prisma.qrCode.create({ data: { code: 'demo-cert-qr-0001', type: 'CERTIFICATE', payload: JSON.stringify({ ...certQrBody, sig: certQrSig }), parcelId: soldParcel.id } });
  await prisma.certificate.create({ data: { certificateNumber: 'LG-CERT-2026-DEMO0001', parcelId: soldParcel.id, ownerId: buyer.id, transactionId: soldTx.id, signature: certSig, qrCodeId: certQr.id } });

  // ─── Active offer awaiting seller response ──────────────────────────────────
  await prisma.transaction.create({ data: { parcelId: p2.id, buyerId: buyer.id, sellerId: seller2.id, offerAmount: 6_200_000, status: 'OFFER_MADE' } });
  await prisma.landParcel.update({ where: { id: p2.id }, data: { status: 'UNDER_OFFER' } });

  // ─── QR codes for the verified/listed parcels ───────────────────────────────
  for (const p of [p1, p3]) {
    const code = crypto.randomBytes(16).toString('hex');
    const payloadObj = { v: 1, type: 'PARCEL', code, parcelId: p.id, issuedAt: new Date().toISOString() };
    const sig = crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret').update(JSON.stringify(payloadObj)).digest('hex');
    await prisma.qrCode.create({ data: { code, type: 'PARCEL', payload: JSON.stringify({ ...payloadObj, sig }), parcelId: p.id } });
  }

  // ─── Fraud flags on the fraud demo parcel ───────────────────────────────────
  await prisma.landParcel.update({ where: { id: pFraud.id }, data: { riskScore: 100, status: 'FLAGGED' } });
  await prisma.fraudFlag.createMany({ data: [
    { parcelId: pFraud.id, type: 'DUPLICATE_TITLE', severity: 'CRITICAL', score: 45, description: 'Title deed TD-NRB-2021-00451 already registered on parcel NAIROBI/KAREN/BLK12/451.' },
    { parcelId: pFraud.id, userId: fraudster.id, type: 'BLACKLISTED_USER', severity: 'CRITICAL', score: 60, description: 'Seller is blacklisted: Previously filed forged title deeds.' },
  ] });

  // ─── A couple of notifications, a message, a complaint ──────────────────────
  await prisma.notification.create({ data: { userId: seller.id, title: 'Welcome to LandGuard', body: 'Your seller account is ready. List your first parcel to get started.', type: 'INFO' } });
  await prisma.notification.create({ data: { userId: admin.id, title: '🚨 High-risk parcel detected', body: 'A parcel scored 100/100 and was auto-flagged for review.', type: 'FRAUD_ALERT', link: '/dashboard/fraud' } });
  await prisma.message.create({ data: { senderId: buyer.id, receiverId: seller.id, parcelId: p1.id, content: 'Hi, is the Karen plot still available? Can we arrange a site visit?' } });
  await prisma.complaint.create({ data: { raisedById: buyer.id, againstUserId: fraudster.id, parcelId: pFraud.id, subject: 'Suspected fake listing', description: 'This Karen plot looks too cheap and the seller is evasive about the title.', status: 'OPEN' } });

  console.log('✅ Seed complete.');
  console.log(`\n   Demo login password for all accounts: ${PASSWORD}`);
  console.table([
    { role: 'ADMIN', email: 'admin@landguard.co.ke' },
    { role: 'GOVERNMENT_OFFICER', email: 'officer@landguard.co.ke' },
    { role: 'SURVEYOR', email: 'surveyor@landguard.co.ke' },
    { role: 'SELLER', email: 'seller@landguard.co.ke' },
    { role: 'BUYER', email: 'buyer@landguard.co.ke' },
  ]);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
