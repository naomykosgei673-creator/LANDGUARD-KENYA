# Software Requirements Specification (SRS)
## Secure Land Selling & Ownership Verification Management System — "LandGuard Kenya"

**Document version:** 1.0 · **Standard:** IEEE 830 (adapted) · **Date:** 2026

---

## 1. Introduction

### 1.1 Purpose
This SRS specifies the requirements for **LandGuard Kenya**, an enterprise platform
that reduces land fraud in Kenya by combining document verification, multi-stage
government approval, AI-assisted fraud detection, secure payments, ownership
tracking, and QR-verifiable digital title certificates.

### 1.2 Scope
The system serves five user classes (Buyer, Seller, Administrator, Government Land
Officer, Surveyor). It manages the complete lifecycle of a land parcel from
registration and verification through listing, offer, government approval, secure
payment, ownership transfer, and certificate issuance. It maintains an immutable
audit trail of every security-relevant action.

### 1.3 Definitions
| Term | Meaning |
|------|---------|
| Parcel | A registered piece of land with a unique parcel number and title deed |
| RBAC | Role-Based Access Control |
| TOTP | Time-based One-Time Password (2FA) |
| Risk score | 0–100 fraud likelihood computed by the fraud engine |
| Certificate | Digitally-signed, QR-verifiable proof of ownership |

### 1.4 References
Google Maps Platform; Safaricom Daraja (M-Pesa) API; Prisma ORM; OWASP ASVS.

---

## 2. Overall Description

### 2.1 Product perspective
A three-tier web application: a Next.js/React client, a Node.js/Express REST API
with a Socket.IO realtime channel, and a PostgreSQL database (SQLite in
development) accessed via Prisma. External integrations: Firebase Storage
(documents), Google Maps (geolocation), and payment providers (M-Pesa, card, bank).

### 2.2 User classes
- **Buyer** — searches verified land, makes offers, pays, receives certificates.
- **Seller** — registers parcels, uploads documents, submits for verification.
- **Administrator** — manages users, reviews first-stage verification, oversees fraud, reads audit trail.
- **Government Land Officer** — performs government verification and approves ownership transfers.
- **Surveyor** — performs survey approval and completes site visits.

### 2.3 Operating environment
Modern browsers (Chrome, Edge, Firefox, Safari). Server: Node.js 20+, PostgreSQL
14+. Containerised with Docker; CI/CD via GitHub Actions.

### 2.4 Design & implementation constraints
- All state-changing endpoints require JWT authentication and RBAC authorisation.
- Duplicate parcel/title-deed numbers must be *detectable* (not silently rejected),
  so uniqueness is enforced by the fraud engine and workflow, not a hard DB constraint.
- Payments must never precede government approval of a transfer.

### 2.5 Assumptions and dependencies
Availability of provider sandboxes for M-Pesa/card in non-production; a seeded
dataset is provided for demonstration.

---

## 3. Functional Requirements

### FR-1 Authentication & Authorisation
- FR-1.1 Users register as Buyer or Seller; privileged roles are provisioned by an Admin.
- FR-1.2 Login issues a short-lived JWT access token and a rotating refresh token.
- FR-1.3 Users may enable TOTP two-factor authentication.
- FR-1.4 Every endpoint enforces role- and permission-based access (RBAC).

### FR-2 Land Management
- FR-2.1 Sellers create parcels with location, size, land use, price and description.
- FR-2.2 Sellers attach documents (title deed, survey map, ID, land search, etc.).
- FR-2.3 A parcel may be submitted for verification only with a title-deed document.
- FR-2.4 Buyers browse only verified/listed parcels; officials see all.

### FR-3 Verification Workflow
- FR-3.1 Submission creates an Admin-Review record and runs a fraud scan.
- FR-3.2 Approval advances Admin → Government → Survey; final approval lists the parcel.
- FR-3.3 Rejection at any stage returns the parcel to the seller with notes.

### FR-4 Fraud Detection (rule layer + ML model)
- FR-4.1 Detect duplicate parcel numbers and duplicate title deeds.
- FR-4.2 Detect fake/tampered documents via SHA-256 fingerprint collisions across sellers.
- FR-4.3 Detect blacklisted sellers, duplicate ownership, and expired documents.
- FR-4.4 Detect suspicious listing velocity (≥5 listings/24h) and steep below-market pricing.
- FR-4.5 Emit weighted, explainable flags (the evidence) and engineer a 9-feature vector.
- FR-4.6 Score the feature vector with a **machine-learning classifier** (logistic
  regression, served by the Python ML microservice) producing a calibrated 0–100 risk
  score; auto-flag parcels ≥60, block their submission, and alert admins.
- FR-4.7 If the ML service is unavailable, fall back to the rule layer's weighted sum
  (graceful degradation) — scoring must never block on the model.

**Fraud model (ML component).** Binary logistic regression trained by L2-regularised
gradient descent on a labelled, domain-informed dataset; features: duplicate title,
duplicate parcel, blacklisted seller, document hash collision, expired documents,
missing title deed, listing velocity, price-below-market ratio, owner mismatch.
Test accuracy ≈ 99%, F1 ≈ 0.98. Each score returns per-feature contributions for
explainability. See [`ml-service/`](../ml-service/README.md).

### FR-5 Transactions & Payments
- FR-5.1 Buyers make offers on listed parcels; sellers accept or reject.
- FR-5.2 Accepted offers require Government Officer approval before payment.
- FR-5.3 Buyers pay via M-Pesa, Visa, MasterCard or Bank Transfer.
- FR-5.4 Successful payment atomically transfers ownership, records history, and issues a signed certificate.

### FR-6 QR Verification
- FR-6.1 Verified parcels and certificates carry a signed QR code.
- FR-6.2 Anyone may verify a QR (no account) to confirm authenticity and current owner.

### FR-7 Communication & Support
- FR-7.1 In-app 1:1 messaging with realtime delivery (Socket.IO).
- FR-7.2 Notifications for verification, offers, payments and fraud alerts.
- FR-7.3 Users may file complaints; Admin/Officer investigate and resolve.

### FR-8 Reporting & Audit
- FR-8.1 Role-aware dashboards with KPIs and platform analytics.
- FR-8.2 An immutable audit log records every security-relevant action.

---

## 4. Non-Functional Requirements
- **Security:** bcrypt password hashing, JWT + refresh rotation, 2FA, RBAC, Helmet
  headers, CORS, rate limiting, Zod input validation, HMAC digital signatures,
  parameterised queries (Prisma) preventing SQL injection, audit trail.
- **Performance:** paginated list endpoints; indexed queries; API p95 < 300 ms under nominal load.
- **Reliability:** atomic multi-step operations via database transactions; idempotent settlement.
- **Usability:** responsive UI, role-tailored dashboards, accessible components.
- **Maintainability:** modular backend (per-domain routers/services), typed end-to-end (TypeScript).
- **Portability:** identical schema on SQLite (dev) and PostgreSQL (prod); Dockerised.

---

## 5. Acceptance Criteria (traceability highlights)
| Requirement | Verified by |
|-------------|-------------|
| FR-1.2 JWT + refresh | `POST /auth/login`, `/auth/refresh` return/rotate tokens |
| FR-4.1/4.3 duplicate title + blacklist | Fraud scan flags the seeded duplicate parcel at 100/100 and blocks submission |
| FR-3.2 pipeline | Approvals advance status Admin→Gov→Survey→Listed |
| FR-5.4 settlement | Successful payment yields ownership transfer + certificate |
| FR-6.2 public verify | `GET /qr/verify/:code` validates signature without auth |
