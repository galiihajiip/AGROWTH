"""Unit tests untuk service ``pranata_mangsa``.

Cakupan:
- :func:`_normalize_doy` non-leap, leap day, batas tahun
- :func:`get_current_mangsa` semua 12 mangsa + wrap-around Kapitu
- :func:`get_mangsa_by_id` valid + KeyError
- :func:`list_all_mangsa` urutan & jumlah
- :func:`match_crops_to_mangsa` per anomaly type + max_items + edge cases
"""
from __future__ import annotations

from datetime import date

import pytest

from app.models import AnomalyType, MangsaInfo
from app.services.pranata_mangsa import (
    _normalize_doy,
    get_current_mangsa,
    get_mangsa_by_id,
    list_all_mangsa,
    match_crops_to_mangsa,
)


# ---------- _normalize_doy ----------

@pytest.mark.parametrize("d, expected_doy", [
    (date(2023, 1, 1), 1),
    (date(2023, 1, 31), 31),
    (date(2023, 2, 28), 59),
    (date(2023, 3, 1), 60),
    (date(2023, 6, 22), 173),
    (date(2023, 12, 22), 356),
    (date(2023, 12, 31), 365),
])
def test_normalize_doy_non_leap(d: date, expected_doy: int) -> None:
    assert _normalize_doy(d) == expected_doy


def test_normalize_doy_leap_feb29_maps_to_28() -> None:
    """29 Feb (leap) di-map ke DOY 59 (sama dengan 28 Feb)."""
    assert _normalize_doy(date(2024, 2, 29)) == 59
    assert _normalize_doy(date(2024, 2, 28)) == 59


def test_normalize_doy_leap_post_feb_consistent_with_non_leap() -> None:
    """Tanggal pasca Feb harus DOY sama di tahun leap & non-leap."""
    for d_leap, d_nl in [
        (date(2024, 3, 1), date(2023, 3, 1)),
        (date(2024, 6, 22), date(2023, 6, 22)),
        (date(2024, 12, 31), date(2023, 12, 31)),
    ]:
        assert _normalize_doy(d_leap) == _normalize_doy(d_nl)


# ---------- get_current_mangsa: setiap mangsa ----------

@pytest.mark.parametrize("d, expected_name, expected_id", [
    (date(2025, 6, 22),  "Kasa",     1),
    (date(2025, 7, 15),  "Kasa",     1),
    (date(2025, 8, 1),   "Kasa",     1),
    (date(2025, 8, 2),   "Karo",     2),
    (date(2025, 8, 24),  "Karo",     2),
    (date(2025, 8, 25),  "Katiga",   3),
    (date(2025, 9, 17),  "Katiga",   3),
    (date(2025, 9, 18),  "Kapat",    4),
    (date(2025, 10, 12), "Kapat",    4),
    (date(2025, 10, 13), "Kalima",   5),
    (date(2025, 11, 8),  "Kalima",   5),
    (date(2025, 11, 9),  "Kanem",    6),
    (date(2025, 12, 21), "Kanem",    6),
    (date(2025, 12, 22), "Kapitu",   7),
    (date(2025, 12, 31), "Kapitu",   7),
    (date(2026, 1, 1),   "Kapitu",   7),
    (date(2026, 2, 2),   "Kapitu",   7),
    (date(2026, 2, 3),   "Kawolu",   8),
    (date(2026, 2, 28),  "Kawolu",   8),
    (date(2026, 3, 1),   "Kasanga",  9),
    (date(2026, 3, 25),  "Kasanga",  9),
    (date(2026, 3, 26),  "Kasadasa", 10),
    (date(2026, 4, 18),  "Kasadasa", 10),
    (date(2026, 4, 19),  "Desta",    11),
    (date(2026, 5, 11),  "Desta",    11),
    (date(2026, 5, 12),  "Sadha",    12),
    (date(2026, 6, 21),  "Sadha",    12),
])
def test_get_current_mangsa_all_periods(
    d: date, expected_name: str, expected_id: int,
) -> None:
    """Setiap batas periode 12 mangsa harus tepat."""
    mangsa = get_current_mangsa(d)
    assert mangsa.name == expected_name
    assert mangsa.number == expected_id


def test_kapitu_wrap_around() -> None:
    """Kapitu melintasi pergantian tahun (22 Des – 2 Feb)."""
    assert get_current_mangsa(date(2024, 12, 22)).name == "Kapitu"
    assert get_current_mangsa(date(2025, 1, 1)).name == "Kapitu"
    assert get_current_mangsa(date(2025, 1, 31)).name == "Kapitu"
    assert get_current_mangsa(date(2025, 2, 2)).name == "Kapitu"
    # Hari berikutnya pindah ke Kawolu
    assert get_current_mangsa(date(2025, 2, 3)).name == "Kawolu"


def test_leap_day_falls_in_kawolu() -> None:
    """29 Februari pada tahun kabisat tetap di Kawolu."""
    assert get_current_mangsa(date(2024, 2, 29)).name == "Kawolu"


def test_get_current_mangsa_returns_mangsa_info() -> None:
    m = get_current_mangsa(date(2025, 1, 15))
    assert isinstance(m, MangsaInfo)
    assert m.season in {"hujan", "kemarau", "pancaroba", "umum"}
    assert m.duration_days >= 1
    assert m.characteristics  # non-empty


# ---------- get_mangsa_by_id ----------

@pytest.mark.parametrize("mid, name", [
    (1, "Kasa"), (2, "Karo"), (5, "Kalima"), (7, "Kapitu"), (12, "Sadha"),
])
def test_get_mangsa_by_id_valid(mid: int, name: str) -> None:
    m = get_mangsa_by_id(mid)
    assert m.number == mid
    assert m.name == name


@pytest.mark.parametrize("bad_id", [0, 13, -1, 999])
def test_get_mangsa_by_id_raises_keyerror(bad_id: int) -> None:
    with pytest.raises(KeyError):
        get_mangsa_by_id(bad_id)


# ---------- list_all_mangsa ----------

def test_list_all_mangsa_count_and_order() -> None:
    items = list_all_mangsa()
    assert len(items) == 12
    assert [m.number for m in items] == list(range(1, 13))
    assert items[0].name == "Kasa"
    assert items[6].name == "Kapitu"
    assert items[-1].name == "Sadha"


def test_list_all_mangsa_returns_independent_copy() -> None:
    """Mutating returned list must not affect internal cache."""
    a = list_all_mangsa()
    a.pop()
    b = list_all_mangsa()
    assert len(b) == 12


# ---------- match_crops_to_mangsa ----------

def test_match_crops_normal_returns_base_list() -> None:
    """``NORMAL`` mengembalikan ``suitable_crops`` apa adanya (dipotong max)."""
    mangsa_kasa = get_mangsa_by_id(1)
    crops = match_crops_to_mangsa(mangsa_kasa, AnomalyType.NORMAL)
    assert crops == ["padi gogo", "kacang tanah", "jagung", "ubi kayu", "sorgum"]


def test_match_crops_drought_swaps_to_drought_tolerant() -> None:
    """DROUGHT memprioritaskan tanaman tahan kering & menyaring padi sawah."""
    mangsa_kalima = get_mangsa_by_id(5)  # base: padi sawah, sayuran daun, ...
    crops = match_crops_to_mangsa(mangsa_kalima, AnomalyType.DROUGHT)
    assert "sorgum" in crops
    assert "kacang hijau" in crops
    # Padi sawah harus disaring
    assert not any("padi sawah" in c.lower() for c in crops)


def test_match_crops_flood_prioritizes_water_tolerant() -> None:
    """FLOOD memprioritaskan padi tahan rendam + tanaman air."""
    mangsa_kanem = get_mangsa_by_id(6)
    crops = match_crops_to_mangsa(mangsa_kanem, AnomalyType.FLOOD)
    assert any("inpari" in c.lower() or "inpara" in c.lower() for c in crops)
    # Sorgum (sensitif air) harus disaring
    assert not any(c.lower() == "sorgum" for c in crops)


def test_match_crops_heatwave_filters_padi_sawah() -> None:
    mangsa_kalima = get_mangsa_by_id(5)
    crops = match_crops_to_mangsa(mangsa_kalima, AnomalyType.HEATWAVE)
    assert not any("padi sawah" in c.lower() for c in crops)


@pytest.mark.parametrize("anomaly", list(AnomalyType))
def test_match_crops_max_5_items_for_all_anomalies(anomaly: AnomalyType) -> None:
    """Hasil selalu <= 5 item, apapun anomaly type-nya."""
    for mid in range(1, 13):
        m = get_mangsa_by_id(mid)
        out = match_crops_to_mangsa(m, anomaly)
        assert len(out) <= 5, f"mangsa {mid} anomaly {anomaly} > 5: {out}"


def test_match_crops_max_items_param() -> None:
    """Parameter ``max_items`` di-honor."""
    m = get_mangsa_by_id(7)
    out = match_crops_to_mangsa(m, AnomalyType.NORMAL, max_items=2)
    assert len(out) <= 2


def test_match_crops_max_items_zero_returns_empty() -> None:
    m = get_mangsa_by_id(7)
    assert match_crops_to_mangsa(m, AnomalyType.NORMAL, max_items=0) == []


def test_match_crops_no_duplicates_after_swap() -> None:
    """Hasil swap+filter tidak boleh duplikat (case-insensitive)."""
    m = get_mangsa_by_id(5)
    out = match_crops_to_mangsa(m, AnomalyType.DROUGHT)
    lowered = [c.lower() for c in out]
    assert len(lowered) == len(set(lowered))


def test_match_crops_accepts_int_id() -> None:
    """Selain MangsaInfo, ``mangsa`` boleh berupa int id."""
    out = match_crops_to_mangsa(7, AnomalyType.NORMAL)
    assert out, "harus ada hasil untuk Kapitu"
