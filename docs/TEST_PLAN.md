# LandGuard Kenya — Acceptance Test Plan ✅

A hands-on checklist to confirm the whole system works **across every page and every
user role**. Tick each `[ ]` as you go. Every step lists the exact action and the
**expected result**.

> All steps use the seeded demo data. If anything looks off, run `npm run reseed`
> to reset the database to a clean, known state and start again.

---

## 0. Setup (do this first)

```bash
npm run reseed     # reset DB to the known demo state
npm run dev        # start backend :4000 + frontend :3000 + ML :5001
```

Then open **http://localhost:3000**.

- [ ] All three services start with no errors (`BACKEND ... listening`, `FRONTEND ✓ Ready`, `ML ... Running on http://127.0.0.1:5001`).
- [ ] Open **http://localhost:4000/api/health** → returns `{"success":true,...,"status":"ok"}`.

**Demo accounts** — password for all is `Password123!`

| Role | Email | Name |
|------|-------|------|
| Administrator | admin@landguard.co.ke | Amina Otieno |
| Government Officer | officer@landguard.co.ke | James Kariuki |
| Surveyor | surveyor@landguard.co.ke | Naomi Wanjiru |
| Seller | seller@landguard.co.ke | Peter Mwangi |
| Seller 2 | seller2@landguard.co.ke | Grace Achieng |
| Buyer | buyer@landguard.co.ke | David Kiptoo |
| Blacklisted seller | blacklisted@landguard.co.ke | Victor Odhiambo |

> 💡 **Multi-user tip:** each browser tab keeps its own independent login (sessions
> live in `sessionStorage`). Open several tabs — e.g. **Seller** in one, **Buyer** in
> another, **Officer** in a third — and you can act as all of them at once. This is
> how you test the "across users" behaviour and the live auto-refresh.

---

## 1. Login & smoke test (every role)

For **each** of the 6 non-blacklisted accounts:

- [ ] Sign in → you land on a dashboard tailored to that role.
- [ ] The sidebar shows only that role's menu items (see table below).
- [ ] The top-right chip and a coloured accent bar identify which role the tab is.
- [ ] Sign out returns you to `/login`.

**Expected menu per role**

| Role | Should see in sidebar |
|------|------------------------|
| Admin | Overview, Marketplace, Verification Queue, Transfer Approvals, Transactions, Fraud Console, Users, Audit Trail, Notifications |
| Officer | Overview, Marketplace, Verification Queue, Transfer Approvals, Transactions, Fraud Console, Audit Trail, Notifications |
| Surveyor | Overview, Marketplace, Verification Queue, Notifications |
| Seller | Overview, Marketplace, My Parcels, Transactions, Notifications |
| Buyer | Overview, Marketplace, Transactions, Notifications |

- [ ] Wrong password → clear "Invalid email or password" error, no login.

---

## 2. Dashboards show real numbers (per role)

- [ ] **Admin/Officer** Overview: stat cards for users, parcels, live listings, flagged, transactions, completed, pending approvals, value transacted, open fraud flags — all show numbers (not blank/NaN).
- [ ] **Seller** (`seller@`) Overview: My parcels, Live listings, Under review, Pending offers, Sold.
- [ ] **Surveyor** Overview: Survey approvals pending (should be **1** — the Kajiado parcel).
- [ ] **Buyer** Overview: Offers made, Active transactions, Parcels owned (should be **1** — the Ruai plot they already bought).

---

## 3. Verification workflow — end to end, across 4 roles

This is the core pipeline. The seed already has one parcel waiting at **each** stage.

- [ ] **Admin** → Verification Queue → shows the **Mombasa/Nyali** parcel (Admin review). Click **Approve**. → it leaves the admin queue.
- [ ] **Officer** → Verification Queue → shows the **Machakos/Syokimau** parcel (Government verification). Click **Approve**. → leaves the officer queue.
- [ ] **Surveyor** → Verification Queue → shows the **Kajiado/Kitengela** parcel (Survey approval). Click **Approve**. → it becomes **LISTED** and appears in the public Marketplace.
- [ ] On any queue item, click **Run fraud scan** → an alert shows a risk score and flag count.
- [ ] **Reject** path: as any reviewer, type a note and click **Reject** on a queued parcel → the seller (Peter) gets a "verification rejected" notification and the parcel status becomes REJECTED.

---

## 4. Seller journey — list a brand-new parcel

Sign in as **seller@**:

- [ ] My Parcels → **New parcel** → fill the form (any valid values) → Save. New parcel appears with status **DRAFT**.
- [ ] On that parcel → **Add document** → choose **Title deed**, pick any PDF/image → Upload. Document count increases.
- [ ] Click **Submit for verification** → success message with a risk score, status becomes **PENDING_ADMIN**.
- [ ] Switch to the **Admin** tab → Verification Queue now contains this new parcel (may need a moment — it should appear **without you refreshing**; see §6).

---

## 5. Buy a parcel — full transaction across Buyer / Seller / Officer

The seed includes an active offer, but do a fresh one end-to-end:

- [ ] **Buyer** → Marketplace → open the **Nairobi/Karen** (or any LISTED) parcel → **Make offer** → submit. You're taken to the transaction page (status **OFFER_MADE**).
- [ ] **Seller** (owner of that parcel) → Transactions → open it → **Accept offer**. Status → **GOV_APPROVAL_PENDING**.
- [ ] **Officer** → Transfer Approvals → the sale is listed → open it → **Approve transfer**. Status → **PAYMENT_PENDING**.
- [ ] **Buyer** → the transaction → **Pay** (try VISA for an instant settle; or M-Pesa/Bank then confirm) → status → **COMPLETED**.
- [ ] A **digital title certificate** panel appears with a certificate number, and ownership transfers to the buyer.
- [ ] **Buyer** Overview → "Parcels owned" increases by 1.

---

## 6. Auto-refresh / live updates — the "across users" test 🔴

Open **two tabs**: Tab A and Tab B. **Do not manually refresh** during these.

- [ ] Tab A = **Seller** on the **Transactions** page. Tab B = **Buyer** makes an offer on that seller's parcel (§5). → Within a couple of seconds, Tab A shows the new offer **and** the sidebar **Notifications badge** increments — no refresh.
- [ ] Tab A = **Admin** on **Verification Queue**. Tab B = **Seller** submits a parcel (§4). → The parcel appears in Tab A's queue on its own.
- [ ] Tab A = **Buyer** on the transaction page (status GOV_APPROVAL_PENDING). Tab B = **Officer** approves it. → Tab A advances to "Payment" on its own.
- [ ] Notifications bell: perform any action that notifies you in another tab → the red badge updates live.
- [ ] Switch away to another app and back to the tab → data refreshes immediately on focus.

---

## 7. Responsiveness & smooth UX

- [ ] **Notifications** page → click **Mark all read** → items grey out **instantly** (no wait). The bell badge clears.
- [ ] Click a single unread notification → it marks read immediately.
- [ ] **Fraud Console** → **Resolve** a flag → it flips to resolved instantly.
- [ ] **Users** (admin) → **Blacklist**/**Lift** a user → button shows a spinner and the status updates; cancelling the reason prompt does nothing.
- [ ] Scroll long pages (Audit Trail, Marketplace, Users) → scrolling is smooth, no jitter, no horizontal shift.
- [ ] For the snappiest navigation, stop dev and run `npm run fast` (production build) — page changes are near-instant.

---

## 8. Access control / security (must all be BLOCKED) 🔒

These confirm users can't do things outside their role.

- [ ] As **Seller** or **Buyer**, there is **no** "Verification Queue" menu item.
- [ ] As **Buyer**, in the browser console run:
  ```js
  fetch('http://localhost:4000/api/verification/queue?stage=ADMIN_REVIEW',
    { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('lg_access') }})
    .then(r => r.json()).then(console.log)
  ```
  → returns `success:false` / **FORBIDDEN** (a buyer must not read reviewer queues).
- [ ] As **Seller**, POST a decision to the admin-review stage of any parcel → **FORBIDDEN** (a seller must not approve verifications).
- [ ] As a seller, you can only edit **your own** DRAFT/REJECTED parcels — editing someone else's is refused.
- [ ] Buyer cannot pay for a transaction that isn't theirs / isn't approved yet.

---

## 9. Fraud detection

- [ ] **Admin/Officer** → Fraud Console → the seeded **Karen "…-DUP"** parcel is flagged: **Duplicate title** + **Blacklisted seller**, risk score 100. Flagged parcels count ≥ 1.
- [ ] Filter by **CRITICAL** → the duplicate/blacklist flags remain.
- [ ] **Reproduce a catch:** as `blacklisted@` (or a normal seller reusing an existing title-deed number), create + submit a parcel → submission is **blocked/flagged** for high fraud risk.
- [ ] The blacklisted seller's listings never appear in the public Marketplace.

---

## 10. QR verification (public, no login)

- [ ] Open **http://localhost:3000/verify/demo-cert-qr-0001** → shows a **valid** certificate (the seeded Ruai sale) with parcel details — works even when logged out.
- [ ] Tamper with the code (change a character) → shows **not found / invalid**.

---

## 11. Notifications, messages, complaints, audit

- [ ] **Complaints:** as Buyer, file a complaint → Admin gets a "New complaint filed" notification (live). Admin → resolve it → the buyer is notified.
- [ ] **Audit Trail** (admin/officer): recent actions (LOGIN, CREATE_PARCEL, APPROVE_*, MAKE_OFFER, PAYMENT…) are logged with user, IP and time. Filter by entity works.
- [ ] **Notifications** page lists your notifications, newest first; unread are highlighted.

---

## 12. Backend API spot-check (optional, terminal)

```bash
# health
curl -s http://localhost:4000/api/health

# login (grab the accessToken from the JSON)
curl -s -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@landguard.co.ke\",\"password\":\"Password123!\"}"
```

- [ ] Health returns ok.
- [ ] Login returns a `user`, `accessToken`, `refreshToken`.
- [ ] A protected route without a token returns `401 UNAUTHORIZED`.

---

## Sign-off

- [ ] Sections 1–11 all pass.
- [ ] No console errors in the browser during normal use.
- [ ] `npm run dev` stays up the whole session (no crashes).

If a step fails, note **which step**, what you saw vs. expected, and whether a
`npm run reseed` + retry reproduces it.
