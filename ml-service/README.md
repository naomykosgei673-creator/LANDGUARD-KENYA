# LandGuard ML Service 🤖

A **Python (Flask)** microservice that scores land-parcel **fraud risk** using a
**logistic-regression classifier implemented from scratch** (no scikit-learn /
numpy dependency — runs on any Python 3.x).

This is the "AI risk score" component of LandGuard. It is a separate service so the
platform is **polyglot** (TypeScript API + Python ML) and so the model can be
scaled, retrained or replaced independently of the main backend.

## Why from-scratch logistic regression?
Every prediction that can **block a land sale** must be auditable. Implementing the
maths directly — sigmoid, log-loss, L2-regularised batch gradient descent, feature
standardisation — means each score is explainable (we return per-feature
contributions) and there is no opaque third-party dependency to justify.

## Model
- **Algorithm:** binary logistic regression, batch gradient descent, L2 regularisation.
- **Features (9):** duplicate title, duplicate parcel, blacklisted seller, document
  hash collision, expired documents, missing title deed, listing velocity,
  price-below-market ratio, owner mismatch.
- **Training data:** 4,000 synthetic, domain-informed labelled samples
  ([`dataset.py`](dataset.py)) split 80/20 train/test.
- **Typical performance:** ~99% test accuracy, F1 ≈ 0.98 (printed at startup).

## Run
```bash
cd ml-service
python -m pip install -r requirements.txt   # flask, flask-cors
python app.py                               # trains, then serves on :5001
```

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + model readiness |
| GET | `/model/info` | Learned weights, bias, train/test metrics, feature schema |
| POST | `/score` | Body `{ "features": { ... } }` → probability, 0-100 risk score, band, top contributors |

### Example
```bash
curl -X POST http://localhost:5001/score -H 'Content-Type: application/json' \
  -d '{"features":{"duplicate_title":1,"seller_blacklisted":1,"price_below_market_ratio":0.6}}'
# → { "probability": 0.99, "riskScore": 100, "band": "CRITICAL", "topContributors": [...] }
```

## Integration
The TypeScript backend ([`backend/src/services/fraud.service.ts`](../backend/src/services/fraud.service.ts))
builds the feature vector from a parcel and its documents, calls `POST /score`, and
uses the returned risk score. If this service is unreachable it **falls back to its
built-in rule-based engine** (configurable via `ML_ENABLED` / `ML_SERVICE_URL`), so
scoring never blocks on the model.

## Files
- [`model.py`](model.py) — logistic regression + standardiser (from scratch)
- [`dataset.py`](dataset.py) — synthetic labelled data generator
- [`app.py`](app.py) — Flask service (trains at startup, serves scoring API)
