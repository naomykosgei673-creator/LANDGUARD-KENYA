# User Manual
## LandGuard Kenya

Password for all demo accounts: **`Password123!`**

| Role | Email |
|------|-------|
| Administrator | admin@landguard.co.ke |
| Government Officer | officer@landguard.co.ke |
| Surveyor | surveyor@landguard.co.ke |
| Seller | seller@landguard.co.ke |
| Buyer | buyer@landguard.co.ke |

---

## 1. Getting started
1. Open `http://localhost:3000`.
2. Click **Get started** to register as a Buyer or Seller, or **Sign in** with a demo account.
3. On the sign-in page, click any demo card to auto-fill its credentials.

## 2. Seller — list and verify land
1. Sign in as a Seller → **My Parcels** → **New parcel**.
2. Fill parcel number, title deed, county, size, price and description → **Create parcel**.
3. Back on **My Parcels**, click **Add document** and upload at least a **Title Deed**.
4. Click **Submit for verification**. The system runs a fraud scan; if the risk
   score is 60+ the submission is blocked and the parcel is flagged.
5. Track progress under each parcel's status: *Pending Admin → Pending Government
   → Pending Survey → Listed*. You are notified at each step.

## 3. Administrator — review & oversight
- **Verification Queue** — approve/reject the first (admin) stage; add notes; run an ad-hoc fraud scan.
- **Fraud Console** — see all risk-scored flags; filter by severity; resolve flags.
- **Users** — search users; blacklist/lift (blacklisting feeds the fraud engine).
- **Audit Trail** — review every security-relevant action, filterable by entity.

## 4. Government Officer — verification & approval
- **Verification Queue** — perform the government verification stage.
- **Transfer Approvals** — approve or reject accepted sales before any payment is taken.

## 5. Surveyor — survey approval
- **Verification Queue** — perform the final survey approval; on approval the parcel
  is automatically listed and issued a verification QR.

## 6. Buyer — search, offer, pay
1. **Marketplace** — filter by county, land use and price; open a parcel to see its
   verification trail, documents and QR.
2. Click **Make an offer** and enter your amount.
3. Wait for **seller acceptance**, then **government approval** (tracked on the
   transaction page's progress bar).
4. When status is *Payment Pending*, choose a method (M-Pesa/Card/Bank) and pay.
5. On success, **ownership transfers to you** and a **digital title certificate**
   (with QR) is issued — visible on the transaction page.

## 7. Verifying a title (anyone)
- Open **Verify a title** from the home page, or scan a certificate's QR code.
- The page confirms authenticity (digital signature intact), the parcel details and
  the current owner — no account required.

## 8. Two-factor authentication
- Call `POST /auth/2fa/setup` (from the app once wired to a settings screen) to get a
  QR for Google Authenticator/Authy, then `POST /auth/2fa/enable` with a 6-digit code.
- Subsequent logins will prompt for the code.

## 9. Notifications & messaging
- The bell icon shows unread counts; **Notifications** lists verification updates,
  offers, payments and fraud alerts (delivered in realtime).
- Buyers and sellers can message each other about a parcel.
