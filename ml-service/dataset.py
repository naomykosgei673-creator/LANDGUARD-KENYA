"""
Synthetic training-data generator for the fraud model.

Each sample is a feature vector (see model.FEATURES) paired with a fraud label.
The generative process encodes realistic domain knowledge — e.g. a duplicated
title deed or a blacklisted seller strongly implies fraud, while a clean parcel
with complete documents implies a genuine listing — plus random noise so the
classifier must *learn* the relationship rather than memorise it.

Deterministic (seeded) for reproducible training.
"""

from __future__ import annotations
import random
from typing import List, Tuple


def generate(n: int = 4000, seed: int = 42) -> Tuple[List[List[float]], List[int]]:
    rng = random.Random(seed)
    X: List[List[float]] = []
    y: List[int] = []

    for _ in range(n):
        # Base rate: ~35% fraudulent in the training distribution.
        fraud = 1 if rng.random() < 0.35 else 0

        if fraud:
            duplicate_title = rng.choice([0, 0, 1, 1, 2])
            duplicate_parcel = rng.choice([0, 0, 1, 1])
            seller_blacklisted = 1 if rng.random() < 0.4 else 0
            doc_hash_collision = rng.choice([0, 1, 1, 2])
            expired_docs = rng.choice([0, 0, 1, 2])
            missing_title_deed = 1 if rng.random() < 0.25 else 0
            listing_velocity = rng.choice([0, 1, 3, 5, 7, 9])
            price_below_market = min(1.0, max(0.0, rng.gauss(0.55, 0.22)))
            owner_mismatch = 1 if rng.random() < 0.35 else 0
        else:
            duplicate_title = 0 if rng.random() < 0.95 else 1
            duplicate_parcel = 0 if rng.random() < 0.97 else 1
            seller_blacklisted = 0
            doc_hash_collision = 0 if rng.random() < 0.97 else 1
            expired_docs = rng.choice([0, 0, 0, 1])
            missing_title_deed = 1 if rng.random() < 0.05 else 0
            listing_velocity = rng.choice([0, 0, 1, 1, 2])
            price_below_market = min(1.0, max(0.0, rng.gauss(0.12, 0.12)))
            owner_mismatch = 0 if rng.random() < 0.97 else 1

        X.append([
            float(duplicate_title), float(duplicate_parcel), float(seller_blacklisted),
            float(doc_hash_collision), float(expired_docs), float(missing_title_deed),
            float(listing_velocity), float(price_below_market), float(owner_mismatch),
        ])
        y.append(fraud)

    return X, y


def train_test_split(X, y, test_ratio=0.2, seed=7):
    rng = random.Random(seed)
    idx = list(range(len(X)))
    rng.shuffle(idx)
    cut = int(len(X) * (1 - test_ratio))
    tr, te = idx[:cut], idx[cut:]
    return ([X[i] for i in tr], [y[i] for i in tr], [X[i] for i in te], [y[i] for i in te])
