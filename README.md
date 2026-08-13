# LandGuard Kenya 🛡️🌍

**Secure Land Selling & Ownership Verification Management System**

---

## What this project does

Buying land in Kenya is risky. People are sold fake title deeds, land that has already been
sold to someone else, or land the seller does not actually own — and by the time the buyer
finds out, the money is gone.

**LandGuard Kenya makes that almost impossible.** Before a piece of land can be advertised,
it must pass an automatic fraud scan *and* be approved by three separate officials. Money
never moves until the government approves the transfer. And when a sale completes, the buyer
gets a digital title certificate with a QR code that **anyone can scan to check it is real** —
no account needed.

---

## 1. How it works — the journey of one piece of land

```
Seller lists land + uploads title deed
        ↓
🤖  Automatic fraud scan   →  risk score 60+ = blocked & flagged
        ↓
👤  Administrator approves
        ↓
🏛️  Government Officer approves
        ↓
📐  Surveyor approves
        ↓
🛒  Published to the marketplace
        ↓
💬  Buyer makes an offer  →  Seller accepts   (still no money!)
        ↓
🏛️  Government approves the transfer
        ↓
💳  Buyer pays (M-Pesa / Card / Bank)
        ↓
📜  Ownership transfers + QR certificate issued
```

**The key idea:** no single person can move land from one owner to another. Fraud would have
to defeat an automatic scan, three independent officials, and a cryptographic signature — and
every step is permanently written to an audit trail.

---

## 2. Who uses it — five roles, five dashboards

| Role | What they do |
| :--- | :--- |
| **Seller** | Registers land, uploads documents, submits for verification, responds to offers |
| **Buyer** | Browses verified listings, makes offers, pays, receives the digital certificate |
| **Administrator** | First review stage · manages users · blacklists fraudsters · fraud console · audit trail |
| **Government Officer** | Second review stage · **final approval on every ownership transfer** |
| **Surveyor** | Third review stage · confirms the land physically exists as described |

Each role logs in and sees only what they are allowed to do. That is enforced on the server,
not just hidden in the interface.

---

## 3. Key features

- **🤖 Two-layer fraud detection.** Explainable rules (duplicate title deeds, duplicate parcel
  numbers, blacklisted sellers, forged documents, expired papers, listing floods, prices far
  below market) *plus* a logistic-regression model written from scratch in Python that turns
  those signals into a calibrated 0–100 risk score. A score of 60+ blocks the listing.
  **If the ML service goes down, the system falls back to the rules and keeps running.**
- **✅ Three-stage verification pipeline.** Admin → Government → Surveyor, in order. Each
  reviewer sees only their own queue and can approve or reject with written reasons.
- **🔐 Government-gated payments.** A buyer literally cannot pay until an officer approves the
  transfer. Money moves last, not first.
- **📜 QR title certificates.** Every completed sale issues an HMAC-signed certificate. Alter
  one character and verification fails. The check is **public** — no login required.
- **📄 Document fingerprinting.** Every uploaded file gets a SHA-256 fingerprint, used to spot
  tampering and to catch the same file being filed by two different sellers.
- **🔔 Live updates.** Socket.IO pushes notifications instantly; dashboards refresh themselves
  without anyone hitting reload.
- **📋 Immutable audit trail.** Every login, approval, rejection, payment, blacklisting and QR
  scan is recorded with who, when, from where.
- **🔒 Security throughout.** JWT access + rotating refresh tokens, bcrypt passwords, TOTP
  two-factor authentication, role & permission checks, rate limiting, and full input validation.

---

## 4. How it is built

Four parts that talk to each other:

| Part | Built with | What it is |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind | The website — everything users see and click |
| **Backend** | Node.js, Express, TypeScript, Socket.IO | The engine that enforces every rule |
| **Database** | PostgreSQL (prod) / SQLite (dev), via Prisma | The permanent records — 17 tables |
| **ML service** | Python, Flask | The fraud detective — scores how risky a listing is |

```
landguard/
├── backend/            REST API + realtime server (TypeScript)
│   ├── prisma/         Database schema, demo data seed, analytics SQL
│   └── src/
│       ├── modules/    One folder per feature (auth, land, verification, payments, …)
│       ├── services/   Fraud engine, settlement, QR, payments, notifications, audit
│       └── middleware/  Authentication, role checks, validation, error handling
├── frontend/           Next.js App Router website (TypeScript + Tailwind)
│   ├── src/app/        Pages: landing, marketplace, verify, and the dashboards
│   └── src/lib/        API client, auth state, realtime, auto-refresh
├── ml-service/         Python fraud-scoring microservice
│   ├── app.py          Flask endpoints (/health, /score, /model/info)
│   ├── model.py        Logistic regression, written from scratch
│   └── dataset.py      Synthetic training data generator
├── docs/               SRS, ERD, database reference, API, deployment, user manual, test plan
├── presentation/       Presentation guide + lecturer Q&A
└── docker-compose.yml  Run the whole stack in containers
```

**Languages used:** TypeScript (frontend + backend), Python (ML), SQL (analytics),
Prisma Schema Language (data model).

---

## 5. Running it

You need **Node.js 20+** and **Python 3**.

### First time only
```bash
npm run setup     # installs all 3 services, creates .env files, creates & seeds the database
```

### Every time after that
```bash
npm run dev       # starts Frontend (:3000), Backend (:4000), ML Service (:5001)
```

Then open **http://localhost:3000**.

> **Windows:** just double-click **`start.bat`** — it does the setup and starts everything.

### Handy commands

| Command | What it does |
| :--- | :--- |
| `npm run reseed` | Resets the demo data back to its original state |
| `npm run build` | Production build of the backend and frontend |
| `npm run fast` | Build, then run in production mode |
| `npm run clean` | Clears the frontend build cache |

---

## 6. Demo accounts

All accounts use the password **`Password123!`**

| Role | Email |
| :--- | :--- |
| **Administrator** | `admin@landguard.co.ke` |
| **Government Officer** | `officer@landguard.co.ke` |
| **Surveyor** | `surveyor@landguard.co.ke` |
| **Seller** | `seller@landguard.co.ke` |
| **Buyer** | `buyer@landguard.co.ke` |

💡 **Tip for demonstrations:** sessions are stored per browser tab, so you can be signed in as
**all five roles at once** in five tabs. Each tab shows a coloured stripe and a name badge so
you always know which account you are looking at.

The demo data includes parcels at every stage of the pipeline, a completed sale with a
verifiable certificate (`demo-cert-qr-0001`), and a deliberately fraudulent listing that reuses
an existing title deed number — so every screen has something real to show.

---

## 7. Deploying to production

1. Change the provider in `backend/prisma/schema.prisma` from `"sqlite"` to `"postgresql"`.
2. Set a real `DATABASE_URL` and **new, random** JWT secrets in `backend/.env`.
3. Run `npm run db:migrate && npm run db:seed`.
4. Or run the whole stack in containers: `docker compose up --build`.

Full details, including the production hardening checklist, are in the
[Deployment Guide](docs/DEPLOYMENT.md).

> ⚠️ Payments run in **sandbox mode** by default — the full journey is simulated end to end so
> it can be demonstrated safely. Live M-Pesa / card credentials go in `backend/.env`, and the
> gateway interface is already in place for them.

---

## 8. Documentation

| Document | What's in it |
| :--- | :--- |
| [Presentation Guide](presentation/presentation_guide.docx) | Plain-English explanation, demo script, and lecturer Q&A |
| [Software Requirements Specification](docs/SRS.md) | Functional & non-functional requirements |
| [Entity Relationship Diagram](docs/ERD.md) | How the data is related |
| [Database Reference](docs/DATABASE.md) | Every table, field by field |
| [API Reference](docs/API.md) | Every endpoint |
| [ML Fraud Engine](ml-service/README.md) | How the model works and how it is trained |
| [User Manual](docs/USER_MANUAL.md) | How to use the system, per role |
| [Test Plan](docs/TEST_PLAN.md) | Step-by-step acceptance tests |
| [Deployment Guide](docs/DEPLOYMENT.md) | Local, Docker and production setup |
