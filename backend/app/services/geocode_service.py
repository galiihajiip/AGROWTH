"""Reverse geocode service — Nominatim (OpenStreetMap).

Gratis, tanpa API key. Mengembalikan detail lokasi hingga tingkat
kelurahan/desa dari koordinat lat/lon.

Nominatim usage policy:
- Max 1 req/detik → dipatuhi via in-process rate limiter.
- User-Agent wajib di-set (kami set ke "AGROWTH/1.0").
- Cache TTL 1 jam per koordinat (dibulatkan ke 3 desimal ~111 m presisi).
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

import httpx

from app.models import LocationInfo

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory LRU cache sederhana (max 512 entri, TTL 1 jam)
# ---------------------------------------------------------------------------

_CACHE_TTL = 3600          # detik
_CACHE_MAX = 512

_cache: dict[str, tuple[float, LocationInfo]] = {}   # key → (timestamp, result)
_cache_keys: list[str] = []                          # insertion-order untuk LRU evict


def _cache_key(lat: float, lon: float) -> str:
    """Bulatkan ke 3 desimal (~111 m) sebagai cache key."""
    return f"{round(lat, 3)},{round(lon, 3)}"


def _cache_get(key: str) -> Optional[LocationInfo]:
    entry = _cache.get(key)
    if entry is None:
        return None
    ts, result = entry
    if time.monotonic() - ts > _CACHE_TTL:
        _cache.pop(key, None)
        try:
            _cache_keys.remove(key)
        except ValueError:
            pass
        return None
    return result


def _cache_set(key: str, result: LocationInfo) -> None:
    if key in _cache:
        _cache[key] = (time.monotonic(), result)
        return
    if len(_cache_keys) >= _CACHE_MAX:
        oldest = _cache_keys.pop(0)
        _cache.pop(oldest, None)
    _cache[key] = (time.monotonic(), result)
    _cache_keys.append(key)


# ---------------------------------------------------------------------------
# Rate limiter — max 1 req/detik (Nominatim policy)
# ---------------------------------------------------------------------------

_last_request_time: float = 0.0
_rate_lock = asyncio.Lock()


async def _rate_limited_get(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
    global _last_request_time
    async with _rate_lock:
        now = time.monotonic()
        elapsed = now - _last_request_time
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)
        _last_request_time = time.monotonic()
    return await client.get(url, **kwargs)


# ---------------------------------------------------------------------------
# Nominatim reverse geocode
# ---------------------------------------------------------------------------

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
_USER_AGENT = "AGROWTH/1.0 (agrowth-iyref; contact: agrowth@upnjatim.ac.id)"
_TIMEOUT = 8.0


def _extract_location(lat: float, lon: float, data: dict) -> LocationInfo:
    """Parse Nominatim JSON response → LocationInfo."""
    addr: dict = data.get("address", {})

    # Kelurahan / desa — urutan prioritas dari paling spesifik
    kelurahan: Optional[str] = (
        addr.get("village")
        or addr.get("suburb")
        or addr.get("neighbourhood")
        or addr.get("hamlet")
        or addr.get("quarter")
    )

    # Kecamatan
    kecamatan: Optional[str] = (
        addr.get("municipality")
        or addr.get("city_district")
        or addr.get("district")
        or addr.get("subdistrict")
    )

    # Kabupaten / Kota
    region: Optional[str] = (
        addr.get("city")
        or addr.get("county")
        or addr.get("regency")
    )

    # Provinsi
    province: Optional[str] = addr.get("state") or addr.get("province")

    # Nama display: gunakan tampilan paling granular yang tersedia
    name: Optional[str] = kelurahan or kecamatan or region or province

    return LocationInfo(
        lat=lat,
        lon=lon,
        name=name,
        kelurahan=kelurahan,
        kecamatan=kecamatan,
        region=region,
        province=province,
    )


async def reverse_geocode(lat: float, lon: float) -> Optional[LocationInfo]:
    """Reverse geocode koordinat → LocationInfo detail via Nominatim.

    - Return ``None`` bila gagal (timeout, network error, dll).
    - Hasil di-cache 1 jam per ~111m tile.
    - Rate-limited otomatis ke ≤ 1 req/detik.
    """
    key = _cache_key(lat, lon)
    cached = _cache_get(key)
    if cached is not None:
        logger.debug("Geocode cache hit: %s", key)
        return cached

    params = {
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "format": "jsonv2",
        "addressdetails": 1,
        "accept-language": "id",       # respons dalam Bahasa Indonesia
        "zoom": 16,                    # level detail: kelurahan/desa
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(_TIMEOUT),
            headers={"User-Agent": _USER_AGENT},
            follow_redirects=True,
        ) as client:
            resp = await _rate_limited_get(client, _NOMINATIM_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        result = _extract_location(lat, lon, data)
        _cache_set(key, result)
        logger.info(
            "Geocode OK (%.4f, %.4f): %s / %s / %s / %s",
            lat, lon, result.kelurahan, result.kecamatan, result.region, result.province,
        )
        return result

    except Exception as exc:
        logger.warning("Geocode gagal (%.4f, %.4f): %s", lat, lon, exc)
        return None
