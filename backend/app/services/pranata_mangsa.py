"""Engine Pranata Mangsa: lookup mangsa aktif berdasarkan tanggal + crop matching.

Memuat ``app/data/pranata_mangsa.json`` saat import dan menyajikan API
deterministik untuk:
- mendapatkan mangsa aktif pada sebuah tanggal (dengan wrap Kapitu Des-Feb),
- mengambil mangsa berdasarkan id atau seluruh daftar,
- memilih daftar tanaman yang sesuai dengan mangsa & jenis anomali iklim.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Dict, List, Union

from app.models import AnomalyType, MangsaInfo

# ---------- Module-level cache (loaded once at import) ----------

_DATA_FILE: Path = Path(__file__).resolve().parent.parent / "data" / "pranata_mangsa.json"

with _DATA_FILE.open("r", encoding="utf-8") as _fh:
    _RAW_DATA: dict = json.load(_fh)

_RAW_MANGSA: List[dict] = _RAW_DATA["mangsa"]
_RAW_BY_ID: Dict[int, dict] = {entry["id"]: entry for entry in _RAW_MANGSA}


# ---------- Helpers untuk konversi DOY ↔ MM-DD ----------

# Tabel kumulatif hari per bulan untuk tahun non-kabisat
_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def _doy_to_mmdd(doy: int) -> str:
    """Konversi DOY (1-365) ke string ``MM-DD`` pada tahun non-kabisat."""
    if not 1 <= doy <= 365:
        raise ValueError(f"DOY {doy} di luar 1..365")
    rem = doy
    for m, days in enumerate(_MONTH_DAYS, start=1):
        if rem <= days:
            return f"{m:02d}-{rem:02d}"
        rem -= days
    raise RuntimeError("unreachable")


def _normalize_doy(d: date) -> int:
    """Konversi date ke DOY 1..365 (tahun non-kabisat sebagai referensi).

    Pada tahun kabisat, 29 Februari dipetakan ke DOY 59 (= 28 Februari).
    """
    if d.month == 2 and d.day == 29:
        return 59  # diperlakukan sebagai 28 Feb
    # Hitung DOY langsung berbasis MONTH_DAYS (non-kabisat) supaya konsisten
    return sum(_MONTH_DAYS[: d.month - 1]) + d.day


def _derive_season(weather_pattern: str) -> str:
    """Heuristik turunkan musim umum dari deskripsi weather_pattern."""
    text = weather_pattern.lower()
    if "pancaroba" in text:
        return "pancaroba"
    if "puncak musim hujan" in text or ("hujan" in text and "kemarau" not in text):
        return "hujan"
    if "akhir musim hujan" in text or "awal kemarau" in text or "akhir kemarau" in text:
        return "pancaroba"
    if "kemarau" in text:
        return "kemarau"
    if "hujan" in text:
        return "hujan"
    return "umum"


def _split_advice(advice: str) -> List[str]:
    """Pecah teks saran tradisional menjadi item list (per kalimat)."""
    parts = [p.strip() for p in advice.replace(";", ".").split(".") if p.strip()]
    return parts


def _to_mangsa_info(entry: dict) -> MangsaInfo:
    """Konversi entry JSON → MangsaInfo (Pydantic model)."""
    return MangsaInfo(
        number=entry["id"],
        name=entry["name"],
        period_start=_doy_to_mmdd(entry["period_start_doy"]),
        period_end=_doy_to_mmdd(entry["period_end_doy"]),
        duration_days=entry["duration_days"],
        season=_derive_season(entry["weather_pattern"]),
        description=entry["characteristics"],
        characteristics=list(entry["natural_signs"]),
        recommended_activities=_split_advice(entry["traditional_advice"]),
        avoid_activities=[],
    )


_MANGSA_LIST: List[MangsaInfo] = [_to_mangsa_info(e) for e in _RAW_MANGSA]
_BY_ID: Dict[int, MangsaInfo] = {m.number: m for m in _MANGSA_LIST}


# ---------- Public API: lookup ----------

def get_current_mangsa(d: Union[date, None] = None) -> MangsaInfo:
    """Kembalikan mangsa yang aktif pada tanggal ``d`` (default: hari ini).

    Menangani wrap-around mangsa Kapitu (DOY 356..365 → 1..33).
    """
    if d is None:
        d = date.today()
    doy = _normalize_doy(d)

    for entry in _RAW_MANGSA:
        start = entry["period_start_doy"]
        end = entry["period_end_doy"]
        if start <= end:
            if start <= doy <= end:
                return _BY_ID[entry["id"]]
        else:
            # wrap-around (mis. Kapitu: 356..33)
            if doy >= start or doy <= end:
                return _BY_ID[entry["id"]]

    raise ValueError(f"DOY {doy} tidak terpetakan ke mangsa mana pun")


def get_mangsa_by_id(mangsa_id: int) -> MangsaInfo:
    """Ambil MangsaInfo berdasarkan nomor (1..12)."""
    if mangsa_id not in _BY_ID:
        raise KeyError(f"Mangsa id {mangsa_id} tidak ditemukan (harus 1..12)")
    return _BY_ID[mangsa_id]


def list_all_mangsa() -> List[MangsaInfo]:
    """Daftar semua mangsa dalam urutan 1..12."""
    return list(_MANGSA_LIST)


# ---------- Public API: crop matching ----------

# Tanaman tambahan yang dianjurkan saat anomali tertentu (didahulukan).
_ANOMALY_CROP_OVERRIDES: Dict[AnomalyType, List[str]] = {
    AnomalyType.DROUGHT: [
        "sorgum",
        "kacang hijau",
        "ubi kayu (singkong)",
        "kacang tanah",
        "jagung",
    ],
    AnomalyType.EL_NINO: [
        "sorgum",
        "kacang hijau",
        "kacang tanah",
        "kedelai",
        "jagung",
    ],
    AnomalyType.HEATWAVE: [
        "sorgum",
        "ubi jalar",
        "singkong",
        "kacang tunggak",
        "kacang hijau",
    ],
    AnomalyType.FLOOD: [
        "padi Inpari 30 (tahan rendam)",
        "padi Inpara",
        "talas air",
        "kangkung air",
        "padi Mekongga",
    ],
    AnomalyType.LA_NINA: [
        "padi Inpari 30 (tahan rendam)",
        "padi Inpara",
        "talas air",
        "kangkung air",
        "ubi rambat",
    ],
    AnomalyType.NORMAL: [],
}

# Kata kunci tanaman yang TIDAK cocok pada anomali tertentu (akan disaring).
_EXCLUDE_KEYWORDS: Dict[AnomalyType, List[str]] = {
    AnomalyType.DROUGHT: ["padi sawah", "kangkung air", "talas air", "sayuran daun"],
    AnomalyType.EL_NINO: ["padi sawah", "kangkung air", "talas air"],
    AnomalyType.HEATWAVE: ["padi sawah"],
    AnomalyType.FLOOD: ["sorgum", "jagung", "ubi kayu", "kacang tanah", "palawija"],
    AnomalyType.LA_NINA: ["sorgum", "jagung", "ubi kayu", "kacang tanah"],
    AnomalyType.NORMAL: [],
}


def _suitable_crops_of(mangsa_id: int) -> List[str]:
    return list(_RAW_BY_ID[mangsa_id]["suitable_crops"])


def match_crops_to_mangsa(
    mangsa: Union[MangsaInfo, int],
    anomaly: AnomalyType = AnomalyType.NORMAL,
    max_items: int = 5,
) -> List[str]:
    """Filter & swap daftar tanaman mangsa berdasarkan anomali.

    Aturan:
    - ``anomaly == NORMAL`` → kembalikan ``suitable_crops`` (max ``max_items``).
    - Lainnya: hilangkan tanaman yang tidak cocok (lihat ``_EXCLUDE_KEYWORDS``)
      lalu prepend tanaman pengganti dari ``_ANOMALY_CROP_OVERRIDES``.
    - Hasil di-deduplikasi (case-insensitive) dan dipotong ``max_items``.
    """
    if max_items < 1:
        return []

    mangsa_id = mangsa.number if isinstance(mangsa, MangsaInfo) else int(mangsa)
    base = _suitable_crops_of(mangsa_id)

    if anomaly == AnomalyType.NORMAL:
        return base[:max_items]

    excludes = _EXCLUDE_KEYWORDS.get(anomaly, [])
    filtered: List[str] = []
    for crop in base:
        crop_l = crop.lower()
        if any(kw in crop_l for kw in excludes):
            continue
        filtered.append(crop)

    overrides = _ANOMALY_CROP_OVERRIDES.get(anomaly, [])

    result: List[str] = []
    seen: set[str] = set()
    for crop in overrides + filtered:
        key = crop.lower().strip()
        if key in seen:
            continue
        seen.add(key)
        result.append(crop)
        if len(result) >= max_items:
            break

    return result
