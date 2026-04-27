"""AGROWTH Multi-Machine Learning pipeline.

Modul ini mengimplementasikan metode Multi-ML untuk analisis variabel
iklim secara komprehensif. Tiga algoritma digunakan dalam ensemble:

1. **Random Forest** -- Robust terhadap outlier, capture non-linear interactions
2. **Gradient Boosting** -- Presisi tinggi untuk sequential correction
3. **Support Vector Machine** -- Efektif untuk boundary antar kelas anomali

Output ensemble dikombinasikan via soft-voting (rata-rata probabilitas)
untuk menghasilkan klasifikasi anomali dan risk level yang lebih stabil
dari rule-based approach.
"""
from app.ml.predictor import MLPredictor, get_predictor

__all__ = ["MLPredictor", "get_predictor"]
