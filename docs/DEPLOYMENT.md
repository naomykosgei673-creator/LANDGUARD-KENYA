# Deployment Guide
## LandGuard Kenya

## 1. Local development (SQLite — zero infrastructure)
```bash
# Backend
cd backend && cp .env.example .env
npm install && npm run db:push && npm run db:seed && npm run dev   # :4000

# Frontend
cd frontend && cp .env.example .env.local
npm install && npm run dev                                          # :3000

# ML fraud service (Python)
cd ml-service && python -m pip install -r requirements.txt
python app.py                                                       # :5001
```
The backend calls the ML service for fraud scoring and **falls back to its rule
engine** if it is offline, so the ML service is optional for local bring-up.

## 2. Production with PostgreSQL

### 2.1 Switch Prisma to Postgres
In `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
In `backend/.env`:
```
DATABASE_URL="postgresql://landguard:strongpass@db:5432/landguard?schema=public"
NODE_ENV=production
JWT_ACCESS_SECRET=<64 random chars>
JWT_REFRESH_SECRET=<64 random chars>
CORS_ORIGIN=https://app.yourdomain.co.ke
PAYMENTS_SANDBOX=false
# real provider creds (M-Pesa Daraja, card gateway, Firebase, Google Maps)
```
Then:
```bash
npm run db:migrate   # apply versioned migrations
npm run db:seed      # optional: seed reference/demo data
```

### 2.2 Docker Compose (full stack)
From the repository root:
```bash
docker compose up --build
```
This starts three services: `db` (PostgreSQL 16), `backend` (API :4000), and
`frontend` (Next.js :3000). The backend waits for the database, runs migrations,
then boots.

## 3. Environment variables
| Variable | Service | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | backend | Prisma connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | backend | Token signing (use long random secrets) |
| `CORS_ORIGIN` | backend | Allowed frontend origin |
| `MPESA_*` | backend | Safaricom Daraja credentials |
| `FIREBASE_STORAGE_BUCKET`, `STORAGE_DRIVER` | backend | Document storage |
| `ML_ENABLED` / `ML_SERVICE_URL` | backend | Toggle + locate the Python fraud model |
| `NEXT_PUBLIC_API_URL` | frontend | API base URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | frontend | Maps rendering |

## 4. CI/CD (GitHub Actions — outline)
A pipeline should: install deps → `npm run typecheck` (both apps) → `prisma
generate` → build → run tests → build & push Docker images → deploy. A starter
workflow lives at `.github/workflows/ci.yml`.

## 5. Production hardening checklist
- [ ] Rotate all secrets; never ship the dev defaults.
- [ ] Terminate TLS at the load balancer / reverse proxy (HTTPS only).
- [ ] Set secure, httpOnly cookies if moving tokens off localStorage.
- [ ] Enable database backups and point-in-time recovery.
- [ ] Configure real rate limits and a WAF.
- [ ] Verify M-Pesa callback source IP / signature before trusting it.
- [ ] Ship logs/metrics to a central store; alert on `FRAUD_ALERT` notifications.
- [ ] Run `npm audit` and patch before each release.
