"""Training script Multi-ML AGROWTH.

Melatih tiga model (Random Forest, Gradient Boosting, SVM) untuk:
1. **Klasifikasi anomali** -- 6 kelas (normal, el_nino, la_nina, drought, flood, heatwave)
2. **Klasifikasi risk level** -- 4 kelas (low, medium, high, critical)

Dataset: synthetic + augmented berbasis pola klimatologis BMKG,
profil anomali historis, dan konteks GHG regional.

Usage:
    cd backend
    python -m app.ml.train          # Train & simpan ke app/ml/models/
    python -m app.ml.train --eval   # Train + cross-validation report
"""
from __future__ import annotations

import argparse
import hashlib
import math
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC

# Kita perlu import dari package app — pastikan sys.path benar
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.ml.features import (
    FEATURE_NAMES,
    N_FEATURES,
    extract_features,
)
from app.services.bmkg_service import _BMKG_STATIONS, get_monthly_climate

# ---------- Constants ----------

MODELS_DIR = Path(__file__).resolve().parent / "models"
RANDOM_SEED = 42

# Label mappings
ANOMALY_LABELS = ["normal", "el_nino", "la_nina", "drought", "flood", "heatwave"]
RISK_LABELS = ["low", "medium", "high", "critical"]


# ---------- Synthetic data generation ----------

def _generate_training_data(n_samples: int = 8000) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate dataset sintetik berbasis pola klimatologis realistis Jawa.

    Strategi:
    - Grid 12 titik koordinat di Jawa (3 lat x 4 lon)
    - 365 hari per tahun x beberapa skenario per titik
    - Label anomali berdasarkan injeksi pola historis:
      * El Nino: kemarau panjang, suhu naik, hujan berkurang drastis
      * La Nina: hujan berlebih, banjir, suhu lebih rendah
      * Drought: curah hujan < 2mm + suhu tinggi + kelembapan rendah
      * Flood: curah hujan > 80mm + angin kencang
      * Heatwave: suhu > 35C + kelembapan rendah + tanpa hujan
      * Normal: variasi dalam ±1 std dari klimatologis BMKG

    Returns
    -------
    X : ndarray (n, N_FEATURES)
    y_anomaly : ndarray (n,) -- string labels
    y_risk : ndarray (n,) -- string labels
    """
    rng = np.random.default_rng(RANDOM_SEED)

    # Grid koordinat
    lats = [-6.2, -7.0, -7.8]
    lons = [106.5, 108.5, 110.5, 112.5]

    records_X: List[np.ndarray] = []
    labels_anomaly: List[str] = []
    labels_risk: List[str] = []

    samples_per_class = n_samples // len(ANOMALY_LABELS)

    for anomaly_type in ANOMALY_LABELS:
        count = 0
        while count < samples_per_class:
            lat = lats[rng.integers(len(lats))]
            lon = lons[rng.integers(len(lons))]
            doy = rng.integers(1, 366)
            ref = date(2023, 1, 1) + timedelta(days=int(doy) - 1)
            month = ref.month

            # Baseline klimatologis BMKG
            climate = get_monthly_climate(lat, lon, month)
            base_temp = climate["temp_avg_c"]
            base_rain_daily = climate["rainfall_mm"] / 30.0
            base_hum = climate["humidity_pct"]

            # Generate cuaca sesuai tipe anomali
            weather = _inject_anomaly(
                rng, anomaly_type, base_temp, base_rain_daily, base_hum, doy,
            )

            # Solar radiation: estimasi + noise
            dt = weather["temp_max"] - weather["temp_min"]
            base_solar = 3.5 + 1.5 * math.sin(2 * math.pi * (doy - 172) / 365)
            if anomaly_type in ("drought", "heatwave", "el_nino"):
                base_solar += rng.uniform(0.5, 1.5)
            elif anomaly_type in ("flood", "la_nina"):
                base_solar -= rng.uniform(0.5, 1.5)
            solar = max(0.5, base_solar + float(rng.normal(0, 0.3)))

            # Extract features
            feat = extract_features(
                lat=lat, lon=lon, ref_date=ref,
                temp_avg=weather["temp_avg"],
                temp_max=weather["temp_max"],
                temp_min=weather["temp_min"],
                rainfall_mm=weather["rain"],
                humidity_pct=weather["humidity"],
                wind_speed_ms=weather["wind"],
                solar_radiation=solar,
            )
            records_X.append(feat)
            labels_anomaly.append(anomaly_type)

            # Risk level berdasarkan severity
            risk = _assign_risk(anomaly_type, weather)
            labels_risk.append(risk)
            count += 1

    X = np.vstack(records_X)
    y_anomaly = np.array(labels_anomaly)
    y_risk = np.array(labels_risk)

    # Shuffle
    idx = rng.permutation(len(X))
    return X[idx], y_anomaly[idx], y_risk[idx]


def _inject_anomaly(
    rng: np.random.Generator,
    anomaly_type: str,
    base_temp: float,
    base_rain_daily: float,
    base_hum: float,
    doy: int,
) -> Dict[str, float]:
    """Inject pola anomali ke data cuaca baseline."""
    if anomaly_type == "normal":
        temp = base_temp + float(rng.normal(0, 1.0))
        rain = max(0, base_rain_daily + float(rng.normal(0, base_rain_daily * 0.4)))
        hum = min(100, max(40, base_hum + float(rng.normal(0, 4))))
        wind = max(0.1, float(rng.lognormal(0.8, 0.4)))

    elif anomaly_type == "el_nino":
        # Kemarau panjang: suhu naik 1-3C, hujan turun 50-80%, kelembapan turun
        temp = base_temp + float(rng.uniform(1.0, 3.5))
        rain = max(0, base_rain_daily * float(rng.uniform(0.1, 0.5)))
        hum = min(100, max(35, base_hum - float(rng.uniform(5, 15))))
        wind = max(0.1, float(rng.lognormal(0.7, 0.5)))

    elif anomaly_type == "la_nina":
        # Hujan berlebih: suhu turun 0.5-2C, hujan naik 50-150%, kelembapan naik
        temp = base_temp - float(rng.uniform(0.5, 2.5))
        rain = base_rain_daily * float(rng.uniform(1.5, 3.0))
        hum = min(100, base_hum + float(rng.uniform(3, 12)))
        wind = max(0.1, float(rng.lognormal(1.0, 0.5)))

    elif anomaly_type == "drought":
        # Sangat kering: suhu tinggi, hampir tanpa hujan
        temp = base_temp + float(rng.uniform(2.0, 5.0))
        rain = float(rng.uniform(0, 2.0))
        hum = min(100, max(25, base_hum - float(rng.uniform(10, 25))))
        wind = max(0.1, float(rng.lognormal(0.6, 0.4)))

    elif anomaly_type == "flood":
        # Hujan sangat lebat + angin kencang
        temp = base_temp - float(rng.uniform(0, 2.0))
        rain = float(rng.uniform(50, 200))
        hum = min(100, base_hum + float(rng.uniform(5, 15)))
        wind = float(rng.uniform(5, 20))

    elif anomaly_type == "heatwave":
        # Suhu ekstrem tinggi + tanpa hujan
        temp = base_temp + float(rng.uniform(4.0, 8.0))
        rain = float(rng.uniform(0, 1.0))
        hum = min(100, max(20, base_hum - float(rng.uniform(15, 30))))
        wind = max(0.1, float(rng.lognormal(0.5, 0.3)))

    else:
        raise ValueError(f"Unknown anomaly type: {anomaly_type}")

    # Suhu min/max
    diurnal = float(abs(rng.normal(7.0, 1.5)))
    temp_max = temp + diurnal / 2
    temp_min = temp - diurnal / 2

    return {
        "temp_avg": round(temp, 1),
        "temp_max": round(temp_max, 1),
        "temp_min": round(temp_min, 1),
        "rain": round(max(rain, 0), 2),
        "humidity": round(min(100, max(20, hum)), 1),
        "wind": round(max(0.1, wind), 2),
    }


def _assign_risk(anomaly_type: str, weather: Dict[str, float]) -> str:
    """Assign risk level berdasarkan anomali dan severity cuaca."""
    if anomaly_type == "normal":
        return "low"

    severity = 0.0

    if anomaly_type == "drought":
        severity = min(1.0, (weather["temp_avg"] - 30) / 8 + (1 - weather["rain"] / 5))
    elif anomaly_type == "flood":
        severity = min(1.0, weather["rain"] / 150 + weather["wind"] / 20)
    elif anomaly_type == "heatwave":
        severity = min(1.0, (weather["temp_avg"] - 32) / 10 + (1 - weather["humidity"] / 100))
    elif anomaly_type == "el_nino":
        severity = min(1.0, (weather["temp_avg"] - 28) / 6 + (1 - weather["rain"] / 10) * 0.5)
    elif anomaly_type == "la_nina":
        severity = min(1.0, weather["rain"] / 100 + weather["wind"] / 15)

    severity = max(0, severity)

    if severity >= 0.7:
        return "critical"
    elif severity >= 0.45:
        return "high"
    elif severity >= 0.2:
        return "medium"
    return "low"


# ---------- Training ----------

def train_models(eval_mode: bool = False) -> Dict[str, Any]:
    """Train Multi-ML ensemble dan simpan ke disk.

    Returns
    -------
    dict
        Metadata training: metrics, paths, n_samples, dll.
    """
    print("=" * 60)
    print("AGROWTH Multi-ML Training Pipeline")
    print("=" * 60)

    # 1. Generate data
    print("\n[1/5] Generating synthetic training data...")
    X, y_anomaly, y_risk = _generate_training_data(n_samples=9000)
    print(f"      Dataset: {X.shape[0]} samples, {X.shape[1]} features")
    print(f"      Anomaly classes: {dict(zip(*np.unique(y_anomaly, return_counts=True)))}")
    print(f"      Risk classes: {dict(zip(*np.unique(y_risk, return_counts=True)))}")

    # 2. Encode labels
    le_anomaly = LabelEncoder()
    le_risk = LabelEncoder()
    y_a_enc = le_anomaly.fit_transform(y_anomaly)
    y_r_enc = le_risk.fit_transform(y_risk)

    # 3. Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 4. Train anomaly classifier ensemble
    print("\n[2/5] Training anomaly classifiers (3 models)...")
    anomaly_models = _train_ensemble(X_scaled, y_a_enc, "anomaly", eval_mode)

    # 5. Train risk classifier ensemble
    print("\n[3/5] Training risk classifiers (3 models)...")
    risk_models = _train_ensemble(X_scaled, y_r_enc, "risk", eval_mode)

    # 6. Evaluation
    if eval_mode:
        print("\n[4/5] Cross-validation evaluation...")
        _evaluate(X_scaled, y_a_enc, y_r_enc, anomaly_models, risk_models,
                  le_anomaly, le_risk)
    else:
        print("\n[4/5] Skipping evaluation (use --eval to enable)")

    # 7. Save
    print("\n[5/5] Saving models...")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    artifacts = {
        "scaler": scaler,
        "le_anomaly": le_anomaly,
        "le_risk": le_risk,
        "anomaly_rf": anomaly_models["rf"],
        "anomaly_gb": anomaly_models["gb"],
        "anomaly_svm": anomaly_models["svm"],
        "risk_rf": risk_models["rf"],
        "risk_gb": risk_models["gb"],
        "risk_svm": risk_models["svm"],
        "feature_names": FEATURE_NAMES,
        "n_features": N_FEATURES,
    }

    for name, obj in artifacts.items():
        path = MODELS_DIR / f"{name}.joblib"
        joblib.dump(obj, path)
        print(f"      Saved: {path.name}")

    # Metadata
    meta = {
        "n_samples": int(X.shape[0]),
        "n_features": N_FEATURES,
        "feature_names": FEATURE_NAMES,
        "anomaly_classes": list(le_anomaly.classes_),
        "risk_classes": list(le_risk.classes_),
        "models": ["RandomForest", "GradientBoosting", "SVM"],
    }

    print(f"\n{'=' * 60}")
    print("Training complete!")
    print(f"Models saved to: {MODELS_DIR}")
    print(f"{'=' * 60}")

    return meta


def _train_ensemble(
    X: np.ndarray, y: np.ndarray, task_name: str, eval_mode: bool,
) -> Dict[str, Any]:
    """Train 3 model untuk sebuah task (anomaly atau risk)."""
    # Random Forest
    print(f"      Training Random Forest ({task_name})...")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    rf.fit(X, y)

    # Gradient Boosting
    print(f"      Training Gradient Boosting ({task_name})...")
    gb = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=8,
        learning_rate=0.1,
        min_samples_split=5,
        min_samples_leaf=3,
        subsample=0.85,
        random_state=RANDOM_SEED,
    )
    gb.fit(X, y)

    # SVM (dengan probability untuk soft voting)
    print(f"      Training SVM ({task_name})...")
    svm = SVC(
        kernel="rbf",
        C=10.0,
        gamma="scale",
        probability=True,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        cache_size=500,
    )
    svm.fit(X, y)

    return {"rf": rf, "gb": gb, "svm": svm}


def _evaluate(
    X: np.ndarray,
    y_a: np.ndarray,
    y_r: np.ndarray,
    a_models: Dict[str, Any],
    r_models: Dict[str, Any],
    le_a: LabelEncoder,
    le_r: LabelEncoder,
) -> None:
    """Cross-validation + classification report."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)

    for task, models, y, le in [
        ("Anomaly", a_models, y_a, le_a),
        ("Risk", r_models, y_r, le_r),
    ]:
        print(f"\n  === {task} Classification ===")
        for name, model in models.items():
            scores = cross_val_score(model, X, y, cv=cv, scoring="f1_weighted")
            print(f"    {name.upper():4s}  F1-weighted: {scores.mean():.4f} (+/- {scores.std():.4f})")

        # Ensemble prediction on full data
        probs = np.mean(
            [m.predict_proba(X) for m in models.values()],
            axis=0,
        )
        y_pred = np.argmax(probs, axis=1)
        print(f"\n  Ensemble Report ({task}):")
        print(classification_report(y, y_pred, target_names=le.classes_))


# ---------- Entry point ----------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AGROWTH Multi-ML models")
    parser.add_argument("--eval", action="store_true", help="Run cross-validation evaluation")
    args = parser.parse_args()
    train_models(eval_mode=args.eval)
