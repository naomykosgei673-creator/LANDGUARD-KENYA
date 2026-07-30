"""
LandGuard fraud-scoring model.

A logistic-regression classifier implemented from scratch (no scikit-learn /
numpy dependency, so it runs on any Python 3.x). It is trained by batch gradient
descent on a labelled, feature-engineered dataset and exposes calibrated fraud
probabilities plus per-feature contributions for explainability.

Implementing the maths directly (sigmoid, log-loss, gradient descent, feature
standardisation) is deliberate: it makes every prediction auditable and
defensible, which matters for a fraud system that can block a land sale.
"""

from __future__ import annotations
import math
from typing import Dict, List, Tuple

# Ordered feature schema — shared contract with the TypeScript backend.
FEATURES: List[str] = [
    "duplicate_title",            # count of other listings sharing this title deed
    "duplicate_parcel",           # count of other listings sharing this parcel no.
    "seller_blacklisted",         # 1 if the seller is blacklisted
    "doc_hash_collision",         # count of documents byte-identical to another seller's
    "expired_docs",               # count of expired documents
    "missing_title_deed",         # 1 if no title-deed document attached
    "listing_velocity",           # listings created by seller in the last 24h
    "price_below_market_ratio",   # 0..1, how far below county market price (cheaper = riskier)
    "owner_mismatch",             # 1 if seller != recorded current owner
]
N_FEATURES = len(FEATURES)


def sigmoid(z: float) -> float:
    # Numerically stable logistic function.
    if z >= 0:
        ez = math.exp(-z)
        return 1.0 / (1.0 + ez)
    ez = math.exp(z)
    return ez / (1.0 + ez)


class StandardScaler:
    """Zero-mean, unit-variance feature scaling (fit on the training set)."""

    def __init__(self) -> None:
        self.mean: List[float] = [0.0] * N_FEATURES
        self.std: List[float] = [1.0] * N_FEATURES

    def fit(self, X: List[List[float]]) -> "StandardScaler":
        n = len(X)
        for j in range(N_FEATURES):
            col = [row[j] for row in X]
            m = sum(col) / n
            var = sum((v - m) ** 2 for v in col) / n
            self.mean[j] = m
            self.std[j] = math.sqrt(var) or 1.0
        return self

    def transform_row(self, x: List[float]) -> List[float]:
        return [(x[j] - self.mean[j]) / self.std[j] for j in range(N_FEATURES)]


class LogisticRegression:
    """Binary logistic regression trained with L2-regularised gradient descent."""

    def __init__(self, lr: float = 0.3, epochs: int = 800, l2: float = 0.001) -> None:
        self.lr = lr
        self.epochs = epochs
        self.l2 = l2
        self.w: List[float] = [0.0] * N_FEATURES
        self.b: float = 0.0
        self.scaler = StandardScaler()
        self.train_loss: float = 0.0
        self.train_accuracy: float = 0.0

    def _raw(self, xs: List[float]) -> float:
        return self.b + sum(self.w[j] * xs[j] for j in range(N_FEATURES))

    def fit(self, X: List[List[float]], y: List[int]) -> "LogisticRegression":
        self.scaler.fit(X)
        Xs = [self.scaler.transform_row(row) for row in X]
        n = len(Xs)

        for _ in range(self.epochs):
            grad_w = [0.0] * N_FEATURES
            grad_b = 0.0
            for i in range(n):
                pred = sigmoid(self._raw(Xs[i]))
                err = pred - y[i]
                for j in range(N_FEATURES):
                    grad_w[j] += err * Xs[i][j]
                grad_b += err
            for j in range(N_FEATURES):
                grad_w[j] = grad_w[j] / n + self.l2 * self.w[j]
                self.w[j] -= self.lr * grad_w[j]
            self.b -= self.lr * (grad_b / n)

        # Report final training metrics.
        loss = 0.0
        correct = 0
        eps = 1e-12
        for i in range(n):
            p = sigmoid(self._raw(Xs[i]))
            loss += -(y[i] * math.log(p + eps) + (1 - y[i]) * math.log(1 - p + eps))
            if (1 if p >= 0.5 else 0) == y[i]:
                correct += 1
        self.train_loss = loss / n
        self.train_accuracy = correct / n
        return self

    def predict_proba(self, features: Dict[str, float]) -> float:
        x = [float(features.get(name, 0)) for name in FEATURES]
        return sigmoid(self._raw(self.scaler.transform_row(x)))

    def contributions(self, features: Dict[str, float]) -> List[Tuple[str, float]]:
        """Per-feature contribution to the logit (weight × standardised value)."""
        x = [float(features.get(name, 0)) for name in FEATURES]
        xs = self.scaler.transform_row(x)
        contribs = [(FEATURES[j], self.w[j] * xs[j]) for j in range(N_FEATURES)]
        contribs.sort(key=lambda t: abs(t[1]), reverse=True)
        return contribs

    def weights(self) -> Dict[str, float]:
        return {FEATURES[j]: round(self.w[j], 4) for j in range(N_FEATURES)}
