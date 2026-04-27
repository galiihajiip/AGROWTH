"""Runtime ML predictor — load trained models & predict anomaly + risk.

Singleton ``MLPredictor`` memuat 6 model (3 anomaly + 3 risk) + scaler +
label encoders dari disk. Prediksi dilakukan via soft-voting ensemble
(rata-rata probabilitas dari Random Forest, Gradient Boosting, SVM).

Jika model belum di-train (file .joblib belum ada), predictor akan
otomatis menjalankan training saat pertama kali dimuat.
"""
from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np

from app.ml.features import N_FEATURES, extract_features
from app.models import AnomalyType, RiskLevel

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent / "models"

# Mapping string label -> enum
_ANOMALY_MAP: Dict[str, AnomalyType] = {
    "normal": AnomalyType.NORMAL,
    "el_nino": AnomalyType.EL_NINO,
    "la_nina": AnomalyType.LA_NINA,
    "drought": AnomalyType.DROUGHT,
    "flood": AnomalyType.FLOOD,
    "heatwave": AnomalyType.HEATWAVE,
}

_RISK_MAP: Dict[str, RiskLevel] = {
    "low": RiskLevel.LOW,
    "medium": RiskLevel.MEDIUM,
    "high": RiskLevel.HIGH,
    "critical": RiskLevel.CRITICAL,
}


class MLPredictor:
    """Ensemble predictor Multi-ML AGROWTH."""

    def __init__(self) -> None:
        self._loaded = False
        self._scaler: Any = None
        self._le_anomaly: Any = None
        self._le_risk: Any = None
        self._anomaly_models: Dict[str, Any] = {}
        self._risk_models: Dict[str, Any] = {}

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def load(self) -> None:
        """Load semua model dari disk. Auto-train jika belum ada."""
        required_files = [
            "scaler.joblib", "le_anomaly.joblib", "le_risk.joblib",
            "anomaly_rf.joblib", "anomaly_gb.joblib", "anomaly_svm.joblib",
            "risk_rf.joblib", "risk_gb.joblib", "risk_svm.joblib",
        ]

        # Cek apakah semua file ada
        all_exist = all((MODELS_DIR / f).exists() for f in required_files)

        if not all_exist:
            logger.info("Model files belum ada. Menjalankan training otomatis...")
            from app.ml.train import train_models
            train_models(eval_mode=False)

        # Load artifacts
        self._scaler = joblib.load(MODELS_DIR / "scaler.joblib")
        self._le_anomaly = joblib.load(MODELS_DIR / "le_anomaly.joblib")
        self._le_risk = joblib.load(MODELS_DIR / "le_risk.joblib")

        self._anomaly_models = {
            "rf": joblib.load(MODELS_DIR / "anomaly_rf.joblib"),
            "gb": joblib.load(MODELS_DIR / "anomaly_gb.joblib"),
            "svm": joblib.load(MODELS_DIR / "anomaly_svm.joblib"),
        }

        self._risk_models = {
            "rf": joblib.load(MODELS_DIR / "risk_rf.joblib"),
            "gb": joblib.load(MODELS_DIR / "risk_gb.joblib"),
            "svm": joblib.load(MODELS_DIR / "risk_svm.joblib"),
        }

        self._loaded = True
        logger.info(
            "Multi-ML models loaded: %d anomaly + %d risk classifiers",
            len(self._anomaly_models), len(self._risk_models),
        )

    def predict(
        self,
        lat: float,
        lon: float,
        ref_date: date,
        temp_avg: float,
        temp_max: float,
        temp_min: float,
        rainfall_mm: float,
        humidity_pct: float,
        wind_speed_ms: float,
        solar_radiation: Optional[float] = None,
    ) -> Tuple[AnomalyType, RiskLevel, Dict[str, float], Dict[str, float]]:
        """Predict anomaly type + risk level via ensemble.

        Returns
        -------
        anomaly : AnomalyType
        risk : RiskLevel
        anomaly_probs : Dict[str, float]  -- probabilitas per kelas anomali
        risk_probs : Dict[str, float]  -- probabilitas per kelas risk
        """
        if not self._loaded:
            self.load()

        # Extract & scale features
        X_raw = extract_features(
            lat=lat, lon=lon, ref_date=ref_date,
            temp_avg=temp_avg, temp_max=temp_max, temp_min=temp_min,
            rainfall_mm=rainfall_mm, humidity_pct=humidity_pct,
            wind_speed_ms=wind_speed_ms, solar_radiation=solar_radiation,
        )
        X = self._scaler.transform(X_raw)

        # Ensemble predict anomaly (soft voting)
        a_probs = np.mean(
            [m.predict_proba(X) for m in self._anomaly_models.values()],
            axis=0,
        )
        a_idx = int(np.argmax(a_probs[0]))
        a_label = self._le_anomaly.inverse_transform([a_idx])[0]
        anomaly = _ANOMALY_MAP.get(a_label, AnomalyType.NORMAL)

        anomaly_probs = {
            label: round(float(a_probs[0][i]), 4)
            for i, label in enumerate(self._le_anomaly.classes_)
        }

        # Ensemble predict risk (soft voting)
        r_probs = np.mean(
            [m.predict_proba(X) for m in self._risk_models.values()],
            axis=0,
        )
        r_idx = int(np.argmax(r_probs[0]))
        r_label = self._le_risk.inverse_transform([r_idx])[0]
        risk = _RISK_MAP.get(r_label, RiskLevel.LOW)

        risk_probs = {
            label: round(float(r_probs[0][i]), 4)
            for i, label in enumerate(self._le_risk.classes_)
        }

        return anomaly, risk, anomaly_probs, risk_probs

    def predict_multi_day(
        self,
        lat: float,
        lon: float,
        forecast_data: List[Dict[str, Any]],
    ) -> Tuple[AnomalyType, RiskLevel, Dict[str, float], Dict[str, float]]:
        """Predict berdasarkan agregat multi-hari forecast.

        ``forecast_data``: list of dicts with keys date, temp_min_c, temp_max_c,
        humidity_pct, rainfall_mm, wind_speed_ms.

        Aggregate: rata-rata probabilitas dari setiap hari.
        """
        if not self._loaded:
            self.load()

        all_a_probs: List[np.ndarray] = []
        all_r_probs: List[np.ndarray] = []

        for fd in forecast_data:
            d = fd["date"] if isinstance(fd["date"], date) else date.fromisoformat(str(fd["date"]))
            t_avg = (fd["temp_max_c"] + fd["temp_min_c"]) / 2

            X_raw = extract_features(
                lat=lat, lon=lon, ref_date=d,
                temp_avg=t_avg,
                temp_max=fd["temp_max_c"],
                temp_min=fd["temp_min_c"],
                rainfall_mm=fd["rainfall_mm"],
                humidity_pct=fd["humidity_pct"],
                wind_speed_ms=fd["wind_speed_ms"],
            )
            X = self._scaler.transform(X_raw)

            a_prob = np.mean(
                [m.predict_proba(X) for m in self._anomaly_models.values()],
                axis=0,
            )
            r_prob = np.mean(
                [m.predict_proba(X) for m in self._risk_models.values()],
                axis=0,
            )
            all_a_probs.append(a_prob[0])
            all_r_probs.append(r_prob[0])

        # Aggregate: rata-rata probabilitas
        avg_a = np.mean(all_a_probs, axis=0)
        avg_r = np.mean(all_r_probs, axis=0)

        a_idx = int(np.argmax(avg_a))
        a_label = self._le_anomaly.inverse_transform([a_idx])[0]
        anomaly = _ANOMALY_MAP.get(a_label, AnomalyType.NORMAL)

        r_idx = int(np.argmax(avg_r))
        r_label = self._le_risk.inverse_transform([r_idx])[0]
        risk = _RISK_MAP.get(r_label, RiskLevel.LOW)

        anomaly_probs = {
            label: round(float(avg_a[i]), 4)
            for i, label in enumerate(self._le_anomaly.classes_)
        }
        risk_probs = {
            label: round(float(avg_r[i]), 4)
            for i, label in enumerate(self._le_risk.classes_)
        }

        return anomaly, risk, anomaly_probs, risk_probs


# ---------- Singleton ----------

_predictor: Optional[MLPredictor] = None


def get_predictor() -> MLPredictor:
    """Dapatkan singleton MLPredictor (lazy-init + auto-load)."""
    global _predictor
    if _predictor is None:
        _predictor = MLPredictor()
        _predictor.load()
    return _predictor
