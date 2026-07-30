# LandGuard Kenya 🛡️🌍

**Secure Land Selling & Ownership Verification Management System**

An enterprise-grade platform that reduces land fraud in Kenya through document
verification, multi-stage government approval, AI-assisted fraud detection,
secure payments, immutable audit trails, and QR-verifiable digital title
certificates.

> Built for the brief *"Secure Land Selling and Ownership Verification Management
> System"*. This repository contains a **runnable full-stack reference
> implementation** plus full documentation (SRS, ERD, deployment guide, user
> manual).

---

## 1. Architecture

**Polyglot microservice architecture** — three languages, three services:

```
landguard/
├── backend/         Node.js + Express + TypeScript REST API + Socket.IO
│   └── prisma/      Prisma schema (SQLite dev · PostgreSQL prod) + seed + raw SQL analytics
├── frontend/        Next.js 15 (App Router) + TypeScript + Tailwind CSS
├── ml-service/      Python + Flask fraud-scoring ML microservice (from-scratch logistic regression)
├── docs/            SRS, ERD, database schema, deployment guide, user manual
├── docker-compose.yml
└── README.md
```

| Layer      | Technology                                                  |
|------------|-------------------------------------------------------------|
| Frontend   | **TypeScript** — React 19, Next.js 15, Tailwind CSS         |
| Backend    | **TypeScript** — Node.js, Express                            |
| ML service | **Python** — Flask, from-scratch logistic-regression classifier |
| Database   | **SQL** — PostgreSQL (prod) / SQLite (dev) via **Prisma ORM** |
| Auth       | JWT access + refresh tokens, RBAC, TOTP 2FA                  |
| Realtime   | Socket.IO (messaging + live notifications)                  |
| Storage    | Firebase Storage (abstracted `StorageProvider` interface)   |
| Maps       | Google Maps API (parcel geolocation)                        |
| Payments   | M-Pesa, Visa, MasterCard, Bank Transfer (`PaymentGateway`)  |
| Security   | Helmet, CORS, rate-limiting, bcrypt, input validation (Zod), audit trail |

**Languages used:** TypeScript (backend + frontend), Python (ML service),
SQL (analytics/reporting), Prisma Schema Language (data model).

## 2. Roles

`BUYER` · `SELLER` · `ADMIN` · `GOVERNMENT_OFFICER` · `SURVEYOR`
Each role has an independent dashboard and role-based permissions (RBAC).

## 3. Verification workflow

```
Seller Registration → Document Upload → Admin Review → Government Verification
→ Survey Approval → Listing Published → Buyer Search → Offer → Seller Acceptance
→ Government Approval → Payment → Ownership Transfer → Digital Certificate (QR)
```

## 4. Quick start — ONE command (runs today, zero infrastructure)

From the project root, first time only:
```bash
npm run setup     # installs all 3 services, creates env files, seeds the database
```
Then, every time you want to run the whole system:
```bash
npm run dev       # starts backend :4000 + frontend :3000 + ML model :5001 together
```

**Windows users:** just **double-click `start.bat`** — it runs setup automatically
the first time, then launches everything. Press `Ctrl+C` in that window to stop all
three services at once.

Open **http://localhost:3000** and sign in with a demo account below.

### ⚡ Fast (production) mode — recommended for demos

`npm run dev` runs Next.js in **development mode**, which compiles each page the
first time you open it (so navigation feels laggy on the first visit). For a snappy
experience where pages load in milliseconds, build optimised bundles once and run
them:

```bash
npm run fast      # builds everything once, then runs in production mode
```

Windows: **double-click `start-fast.bat`**. Use dev mode only while editing code.

<details>
<summary>Prefer to run each service in its own terminal?</summary>

```bash
cd backend    && npm install && npm run db:push && npm run db:seed && npm run dev   # :4000
cd frontend   && npm install && npm run dev                                          # :3000
cd ml-service && python -m pip install -r requirements.txt && python app.py          # :5001
```
</details>

> The backend calls the ML service for fraud scoring; if it isn't running, the
> backend automatically falls back to its built-in rule engine (graceful degradation).

### Demo accounts (password for all: `Password123!`)

| Role                | Email                      |
|---------------------|----------------------------|
| Administrator       | admin@landguard.co.ke      |
| Government Officer   | officer@landguard.co.ke    |
| Surveyor            | surveyor@landguard.co.ke   |
| Seller              | seller@landguard.co.ke     |
| Buyer               | buyer@landguard.co.ke      |

## 5. Switching to PostgreSQL (production)

1. In `backend/prisma/schema.prisma` set `provider = "postgresql"`.
2. In `backend/.env` set `DATABASE_URL="postgresql://user:pass@host:5432/landguard"`.
3. `npm run db:migrate` then `npm run db:seed`.
4. Or run the whole stack with Docker: `docker compose up --build`.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full production guide.

## 6. Documentation

- [Software Requirements Specification](docs/SRS.md)
- [Entity Relationship Diagram](docs/ERD.md)
- [Database Schema Reference](docs/DATABASE.md)
- [API Reference](docs/API.md)
- [ML Fraud Service](ml-service/README.md)
- [SQL Analytics Views](backend/prisma/sql/analytics.sql)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [User Manual](docs/USER_MANUAL.md)

## 7. License

Reference implementation provided for the client. © 2026 LandGuard Kenya.
