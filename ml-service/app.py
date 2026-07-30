"""
LandGuard ML Service — Flask microservice that scores land-parcel fraud risk.

On startup it generates a labelled dataset, trains the from-scratch logistic
regression model, and evaluates it on a held-out test split. It then serves:

  GET  /health        liveness + model readiness
  GET  /model/info    learned weights, training/test accuracy, feature schema
  POST /score         { "features": {..} } -> probability, 0-100 risk score,
                        risk band, and the top contributing features (explainable)

The TypeScript backend calls POST /score; if this service is unavailable it
falls back to its built-in rule-based engine, so the platform degrades gracefully.
"""

from __future__ import annotations
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from model import LogisticRegression, FEATURES
from dataset import generate, train_test_split

MODEL_VERSION = "lr-1.0.0"

app = Flask(__name__)
CORS(app)

# ─── Train once at startup ────────────────────────────────────────────────────
_X, _y = generate(n=4000, seed=42)
_Xtr, _ytr, _Xte, _yte = train_test_split(_X, _y, test_ratio=0.2)
clf = LogisticRegression(lr=0.3, epochs=800, l2=0.001).fit(_Xtr, _ytr)


def _evaluate(X, y) -> dict:
    tp = tn = fp = fn = 0
    for row, label in zip(X, y):
        feats = {FEATURES[j]: row[j] for j in range(len(FEATURES))}
        pred = 1 if clf.predict_proba(feats) >= 0.5 else 0
        if pred == 1 and label == 1: tp += 1
        elif pred == 0 and label == 0: tn += 1
        elif pred == 1 and label == 0: fp += 1
        else: fn += 1
    total = tp + tn + fp + fn
    accuracy = (tp + tn) / total if total else 0
    precision = tp / (tp + fp) if (tp + fp) else 0
    recall = tp / (tp + fn) if (tp + fn) else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0
    return {
        "accuracy": round(accuracy, 4), "precision": round(precision, 4),
        "recall": round(recall, 4), "f1": round(f1, 4),
        "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
    }


TEST_METRICS = _evaluate(_Xte, _yte)
print(f"[ml-service] trained {MODEL_VERSION} | train_acc={clf.train_accuracy:.3f} "
      f"test_acc={TEST_METRICS['accuracy']:.3f} f1={TEST_METRICS['f1']:.3f}")


def band(score: int) -> str:
    if score >= 60: return "CRITICAL"
    if score >= 40: return "HIGH"
    if score >= 20: return "MEDIUM"
    return "LOW"


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "landguard-ml", "model": MODEL_VERSION, "ready": True})


@app.get("/model/info")
def model_info():
    return jsonify({
        "model": MODEL_VERSION,
        "algorithm": "logistic-regression (from-scratch, L2-regularised gradient descent)",
        "features": FEATURES,
        "weights": clf.weights(),
        "bias": round(clf.b, 4),
        "training": {"samples": len(_Xtr), "accuracy": round(clf.train_accuracy, 4), "log_loss": round(clf.train_loss, 4)},
        "test": TEST_METRICS,
    })


@app.post("/score")
def score():
    payload = request.get_json(silent=True) or {}
    features = payload.get("features", {})
    if not isinstance(features, dict):
        return jsonify({"error": "features must be an object"}), 400

    proba = clf.predict_proba(features)
    risk = int(round(proba * 100))
    contribs = clf.contributions(features)
    top = [
        {"feature": name, "contribution": round(val, 4),
         "direction": "increases risk" if val > 0 else "reduces risk"}
        for name, val in contribs[:5] if abs(val) > 1e-6
    ]
    return jsonify({
        "model": MODEL_VERSION,
        "probability": round(proba, 4),
        "riskScore": risk,
        "band": band(risk),
        "topContributors": top,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port)
