-- ============================================================================
-- LandGuard Kenya — Reporting & analytics SQL
-- ----------------------------------------------------------------------------
-- Hand-written SQL views and queries used for reporting dashboards and audits.
-- Written for PostgreSQL (production). The application normally reaches the DB
-- through Prisma, but these demonstrate the underlying relational model and give
-- analysts direct, tool-agnostic access.
--
-- Apply with:  psql "$DATABASE_URL" -f prisma/sql/analytics.sql
-- ============================================================================

-- 1. Marketplace inventory by county and land use -----------------------------
CREATE OR REPLACE VIEW vw_inventory_by_county AS
SELECT
    county,
    "landUse"                                   AS land_use,
    COUNT(*)                                    AS total_parcels,
    COUNT(*) FILTER (WHERE status = 'LISTED')   AS live_listings,
    COUNT(*) FILTER (WHERE status = 'SOLD')     AS sold,
    COUNT(*) FILTER (WHERE status = 'FLAGGED')  AS flagged,
    ROUND(AVG(price)::numeric, 0)               AS avg_price,
    ROUND(AVG(price / NULLIF("sizeAcres", 0))::numeric, 0) AS avg_price_per_acre
FROM "LandParcel"
GROUP BY county, "landUse"
ORDER BY total_parcels DESC;

-- 2. Fraud exposure summary ---------------------------------------------------
CREATE OR REPLACE VIEW vw_fraud_summary AS
SELECT
    f.type,
    f.severity,
    COUNT(*)                                 AS flag_count,
    COUNT(*) FILTER (WHERE f.resolved)       AS resolved,
    COUNT(*) FILTER (WHERE NOT f.resolved)   AS open,
    ROUND(AVG(f.score)::numeric, 1)          AS avg_weight
FROM "FraudFlag" f
GROUP BY f.type, f.severity
ORDER BY open DESC, flag_count DESC;

-- 3. Sales funnel — conversion from offer to completed transfer ---------------
CREATE OR REPLACE VIEW vw_sales_funnel AS
SELECT
    COUNT(*)                                                         AS offers_made,
    COUNT(*) FILTER (WHERE status <> 'OFFER_MADE'
                     AND status <> 'REJECTED')                       AS accepted_or_beyond,
    COUNT(*) FILTER (WHERE status IN ('GOV_APPROVED','PAYMENT_PENDING',
                     'PAID','TRANSFERRED','COMPLETED'))              AS gov_approved,
    COUNT(*) FILTER (WHERE status IN ('PAID','TRANSFERRED','COMPLETED')) AS paid,
    COUNT(*) FILTER (WHERE status = 'COMPLETED')                     AS completed,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'COMPLETED')
        / NULLIF(COUNT(*), 0), 1)                                    AS completion_rate_pct
FROM "Transaction";

-- 4. Monthly transaction value (revenue trend) --------------------------------
CREATE OR REPLACE VIEW vw_monthly_revenue AS
SELECT
    to_char(date_trunc('month', p."createdAt"), 'YYYY-MM') AS month,
    COUNT(*)                                                AS payments,
    SUM(p.amount) FILTER (WHERE p.status = 'SUCCESS')       AS revenue
FROM "Payment" p
GROUP BY 1
ORDER BY 1;

-- 5. Chain of title for a parcel (ownership history, most recent first) --------
-- Usage: replace :parcel_id
--   SELECT * FROM fn_chain_of_title(:parcel_id);
CREATE OR REPLACE FUNCTION fn_chain_of_title(p_parcel_id text)
RETURNS TABLE (transferred_at timestamp, previous_owner text, new_owner text, transfer_type text)
LANGUAGE sql AS $$
    SELECT oh."createdAt",
           prev."firstName" || ' ' || prev."lastName",
           nw."firstName"   || ' ' || nw."lastName",
           oh."transferType"
    FROM "OwnershipHistory" oh
    LEFT JOIN "User" prev ON prev.id = oh."previousOwnerId"
    JOIN "User" nw ON nw.id = oh."newOwnerId"
    WHERE oh."parcelId" = p_parcel_id
    ORDER BY oh."createdAt" DESC;
$$;

-- 6. Top sellers by completed sales value -------------------------------------
CREATE OR REPLACE VIEW vw_top_sellers AS
SELECT
    u.id,
    u."firstName" || ' ' || u."lastName" AS seller,
    COUNT(t.*)                           AS completed_sales,
    SUM(t."offerAmount")                 AS total_value
FROM "Transaction" t
JOIN "User" u ON u.id = t."sellerId"
WHERE t.status = 'COMPLETED'
GROUP BY u.id, seller
ORDER BY total_value DESC
LIMIT 20;
