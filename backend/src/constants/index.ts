// Centralised domain constants (used instead of DB-native enums for SQLite/PG portability).

export const Roles = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
  ADMIN: 'ADMIN',
  GOVERNMENT_OFFICER: 'GOVERNMENT_OFFICER',
  SURVEYOR: 'SURVEYOR',
} as const;
export type Role = (typeof Roles)[keyof typeof Roles];
export const ALL_ROLES = Object.values(Roles);

export const UserStatus = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', PENDING: 'PENDING' } as const;

// Parcel lifecycle — mirrors the verification workflow in the brief.
export const ParcelStatus = {
  DRAFT: 'DRAFT',
  PENDING_ADMIN: 'PENDING_ADMIN',
  PENDING_GOVERNMENT: 'PENDING_GOVERNMENT',
  PENDING_SURVEY: 'PENDING_SURVEY',
  VERIFIED: 'VERIFIED',
  LISTED: 'LISTED',
  UNDER_OFFER: 'UNDER_OFFER',
  SOLD: 'SOLD',
  REJECTED: 'REJECTED',
  FLAGGED: 'FLAGGED',
} as const;
export type ParcelStatusType = (typeof ParcelStatus)[keyof typeof ParcelStatus];

export const VerificationStage = {
  ADMIN_REVIEW: 'ADMIN_REVIEW',
  GOVERNMENT_VERIFICATION: 'GOVERNMENT_VERIFICATION',
  SURVEY_APPROVAL: 'SURVEY_APPROVAL',
} as const;

export const VerificationStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;

export const DocumentType = {
  TITLE_DEED: 'TITLE_DEED',
  SURVEY_MAP: 'SURVEY_MAP',
  NATIONAL_ID: 'NATIONAL_ID',
  LAND_SEARCH: 'LAND_SEARCH',
  CONSENT: 'CONSENT',
  RATES_CLEARANCE: 'RATES_CLEARANCE',
} as const;

export const DocumentStatus = { PENDING: 'PENDING', VERIFIED: 'VERIFIED', REJECTED: 'REJECTED', EXPIRED: 'EXPIRED' } as const;

export const TransactionStatus = {
  OFFER_MADE: 'OFFER_MADE',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  GOV_APPROVAL_PENDING: 'GOV_APPROVAL_PENDING',
  GOV_APPROVED: 'GOV_APPROVED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAID: 'PAID',
  TRANSFERRED: 'TRANSFERRED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const PaymentMethod = {
  MPESA: 'MPESA',
  VISA: 'VISA',
  MASTERCARD: 'MASTERCARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;

export const PaymentStatus = { PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAILED: 'FAILED', REFUNDED: 'REFUNDED' } as const;

export const FraudType = {
  DUPLICATE_PARCEL: 'DUPLICATE_PARCEL',
  DUPLICATE_TITLE: 'DUPLICATE_TITLE',
  FAKE_DOCUMENT: 'FAKE_DOCUMENT',
  BLACKLISTED_USER: 'BLACKLISTED_USER',
  DUPLICATE_OWNERSHIP: 'DUPLICATE_OWNERSHIP',
  EXPIRED_DOCUMENT: 'EXPIRED_DOCUMENT',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
} as const;

export const FraudSeverity = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' } as const;

export const NotificationType = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  FRAUD_ALERT: 'FRAUD_ALERT',
  TRANSACTION: 'TRANSACTION',
} as const;

// ─── RBAC permission matrix ──────────────────────────────────────────────────
// Fine-grained permissions granted to each role. Checked by requirePermission().
export const Permissions: Record<string, string[]> = {
  BUYER: [
    'parcel:read', 'parcel:search', 'transaction:create', 'transaction:read:own',
    'payment:create', 'message:send', 'complaint:create', 'qr:verify', 'sitevisit:request',
  ],
  SELLER: [
    'parcel:create', 'parcel:read', 'parcel:update:own', 'parcel:submit',
    'document:upload', 'transaction:read:own', 'transaction:respond', 'message:send',
    'complaint:create', 'qr:verify', 'sitevisit:request',
  ],
  GOVERNMENT_OFFICER: [
    'parcel:read', 'verification:government', 'transaction:approve', 'document:verify',
    'document:read', 'fraud:read', 'audit:read', 'qr:verify', 'report:read',
  ],
  SURVEYOR: [
    'parcel:read', 'verification:survey', 'sitevisit:read', 'sitevisit:complete',
    'document:verify', 'qr:verify', 'report:read', 'document:read',
  ],
  ADMIN: ['*'],
};

export function permissionsFor(role: string): string[] {
  const perms = (Permissions as any)[role];
  return Array.isArray(perms) ? [...perms] : [];
}

export function hasPermission(role: string, permission: string): boolean {
  const perms = permissionsFor(role);
  return perms.includes('*') || perms.includes(permission);
}
