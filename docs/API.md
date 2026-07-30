# API Reference
## LandGuard Kenya — Base URL `http://localhost:4000/api`

All responses use the envelope `{ "success": boolean, "data"?: ..., "error"?: { code, message } }`.
List endpoints add `"pagination": { total, page, pageSize, pages }`.
Authenticated endpoints require `Authorization: Bearer <accessToken>`.

## Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register (BUYER or SELLER) → user + tokens |
| POST | `/auth/login` | — | Login (returns `twoFactorRequired` if 2FA enabled) |
| POST | `/auth/refresh` | — | Rotate refresh → new token pair |
| POST | `/auth/logout` | ✔ | Revoke refresh token |
| GET | `/auth/me` | ✔ | Current user |
| POST | `/auth/2fa/setup` | ✔ | Generate TOTP secret + QR |
| POST | `/auth/2fa/enable` | ✔ | Verify code and enable 2FA |
| POST | `/auth/2fa/disable` | ✔ | Disable 2FA |

## Users (Admin)
| GET | `/users` | list/search users |
| POST | `/users` | provision privileged user |
| GET | `/users/:id` | user detail |
| PATCH | `/users/:id` | update role/status |
| POST | `/users/:id/blacklist` | blacklist / lift |

## Parcels
| GET | `/parcels` | search verified listings (public) / all (officials) |
| GET | `/parcels/mine` | seller's parcels |
| GET | `/parcels/:id` | parcel detail (+ verifications, docs, fraud for authorised) |
| POST | `/parcels` | create (seller) |
| PATCH | `/parcels/:id` | update draft/rejected (seller) |
| POST | `/parcels/:id/submit` | submit for verification (runs fraud scan; blocks if ≥60) |
| POST | `/parcels/:id/fraud-scan` | re-run fraud scan (official) |
| POST | `/parcels/:id/qr` | issue verification QR |

## Documents
| POST | `/documents` | upload metadata + SHA-256 (seller) |
| GET | `/documents/parcel/:parcelId` | list parcel documents |
| POST | `/documents/:id/decision` | verify/reject (official) |

## Verification
| GET | `/verification/queue` | role-scoped review queue |
| POST | `/verification/:parcelId/:stage/decision` | approve/reject a stage |
| GET | `/verification/:parcelId/history` | full verification history |

## Transactions
| GET | `/transactions` | role-scoped list |
| GET | `/transactions/:id` | detail |
| POST | `/transactions` | buyer makes offer |
| POST | `/transactions/:id/respond` | seller accept/reject |
| POST | `/transactions/:id/gov-approve` | officer approve/reject transfer |

## Payments
| POST | `/payments` | initiate (MPESA/VISA/MASTERCARD/BANK_TRANSFER) |
| GET | `/payments/:reference` | payment status |
| POST | `/payments/mpesa/callback` | Daraja STK callback (public) |
| POST | `/payments/:reference/confirm-sandbox` | confirm a pending sandbox payment |

## Fraud (Admin/Officer)
| GET | `/fraud` | list flags (filter by severity/type/resolved) |
| GET | `/fraud/stats` | dashboard aggregates |
| POST | `/fraud/:id/resolve` | resolve a flag |

## Messaging / Notifications / Complaints
| GET | `/messages/threads` · `/messages/with/:userId` · POST `/messages` |
| GET | `/notifications` · POST `/notifications/:id/read` · `/notifications/read-all` |
| POST `/complaints` · GET `/complaints` · PATCH `/complaints/:id` |

## QR (public)
| GET | `/qr/verify/:code` | verify signed QR → authenticity + parcel/owner |
| GET | `/qr/render/:code` | PNG data-URL of the QR image |

## Reports / Audit
| GET | `/reports/dashboard` | role-aware KPIs |
| GET | `/reports/analytics` | parcels by status/county/use (Admin/Officer) |
| GET | `/audit` | immutable audit log (Admin/Officer) |

### Example — login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@landguard.co.ke","password":"Password123!"}'
```
