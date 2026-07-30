# Database Schema Reference
## LandGuard Kenya

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
Dev provider: **SQLite**. Prod provider: **PostgreSQL** (change one line + `DATABASE_URL`).

## Tables

### Role
Role definitions and their permission sets (seeded).
`id, name(unique), description, permissions(JSON string), createdAt`

### User
`id, email(unique), phone(unique), passwordHash, firstName, lastName, nationalId(unique?),`
`role, status, avatarUrl, twoFactorEnabled, twoFactorSecret, isBlacklisted, blacklistReason,`
`lastLoginAt, createdAt, updatedAt`
Indexes: `role`, `status`.

### RefreshToken
`id, token(unique), userId→User, expiresAt, revoked, createdAt`

### LandParcel
`id, parcelNumber, titleDeedNumber, county, subCounty, locality, sizeAcres, landUse,`
`price, currency, description, latitude, longitude, geoJson, status, riskScore,`
`featuredImage, sellerId→User, currentOwnerId→User, createdAt, updatedAt`
Indexes: `status, county, sellerId, parcelNumber, titleDeedNumber`.
Status values: `DRAFT, PENDING_ADMIN, PENDING_GOVERNMENT, PENDING_SURVEY, VERIFIED, LISTED, UNDER_OFFER, SOLD, REJECTED, FLAGGED`.

### Document
`id, parcelId→LandParcel, type, fileName, fileUrl, fileHash, mimeType, status, expiryDate,`
`rejectionReason, uploadedById→User, verifiedById→User, createdAt, updatedAt`
Indexes: `parcelId, fileHash, status`. `fileHash` (SHA-256) powers duplicate/tamper detection.

### VerificationRecord
`id, parcelId→LandParcel, stage, status, notes, reviewerId→User, decidedAt, createdAt`
Stages: `ADMIN_REVIEW, GOVERNMENT_VERIFICATION, SURVEY_APPROVAL`.

### Transaction
`id, reference(unique), parcelId→LandParcel, buyerId→User, sellerId→User, offerAmount,`
`status, govApprovedById→User, notes, createdAt, updatedAt`
Status values: `OFFER_MADE, ACCEPTED, REJECTED, GOV_APPROVAL_PENDING, GOV_APPROVED, PAYMENT_PENDING, PAID, TRANSFERRED, COMPLETED, CANCELLED`.

### Payment
`id, transactionId→Transaction, amount, currency, method, status, reference(unique),`
`providerRef, phoneNumber, failureReason, createdAt, updatedAt`
Methods: `MPESA, VISA, MASTERCARD, BANK_TRANSFER`. Status: `PENDING, SUCCESS, FAILED, REFUNDED`.

### OwnershipHistory
`id, parcelId→LandParcel, previousOwnerId→User, newOwnerId→User, transactionId→Transaction, transferType, createdAt`

### Certificate
`id, certificateNumber(unique), parcelId→LandParcel, ownerId→User, transactionId(unique)→Transaction,`
`signature(HMAC), pdfUrl, qrCodeId(unique)→QrCode, issuedAt`

### Message
`id, senderId→User, receiverId→User, parcelId→LandParcel, content, read, createdAt`

### Notification
`id, userId→User, title, body, type, link, read, createdAt`

### Complaint
`id, raisedById→User, againstUserId→User, parcelId→LandParcel, subject, description, status, resolutionNotes, createdAt, updatedAt`

### SiteVisit
`id, parcelId→LandParcel, requestedById→User, surveyorId→User, scheduledAt, status, notes, createdAt`

### FraudFlag
`id, parcelId→LandParcel, userId→User, documentId→Document, type, severity, score, description, resolved, createdAt`
Types: `DUPLICATE_PARCEL, DUPLICATE_TITLE, FAKE_DOCUMENT, BLACKLISTED_USER, DUPLICATE_OWNERSHIP, EXPIRED_DOCUMENT, SUSPICIOUS_ACTIVITY`.

### QrCode
`id, code(unique), type, payload(signed JSON), parcelId→LandParcel, scans, createdAt`

### AuditLog
`id, userId→User, action, entity, entityId, ipAddress, userAgent, metadata(JSON string), createdAt`
Indexes: `userId, entity, createdAt`.

## Migrations
- Dev: `npm run db:push` (schema sync, no migration files) then `npm run db:seed`.
- Prod: `npm run db:migrate` (creates versioned SQL migrations under `prisma/migrations`).
