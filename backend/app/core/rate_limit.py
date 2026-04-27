"""Rate limiting per-IP via slowapi (token-bucket fixed window).

Modul ini mengekspor satu :data:`limiter` instance yang dapat dipakai
sebagai dependency / decorator di setiap router. Limit konkrit dibaca
dari ``AppSettings`` (lihat ``rate_limit_predict`` &
``rate_limit_recommendation``) sehingga bisa di-tune via env tanpa
deploy ulang.

Saat ``RATE_LIMIT_ENABLED=false`` (mis. di test suite), :func:`get_limit`
mengembalikan limit yang sangat longgar (effectively no-op) supaya
behavior endpoint tidak berubah saat unit-test dijalankan paralel.

Storage default: in-memory (process-local). Untuk multi-worker / multi-
replica deployment, ganti ke Redis dengan ``Limiter(... storage_uri=...)``.
"""
from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.settings import get_settings


def _key_func(request: Request) -> str:
    """Pakai IP klien sebagai key (X-Forwarded-For aware via slowapi util).

    Kalau di belakang reverse proxy (nginx, traefik, dst.), pastikan
    server mem-forward header ``X-Forwarded-For`` agar limit per-IP
    benar-benar per-klien, bukan per-proxy.
    """
    return get_remote_address(request)


limiter = Limiter(
    key_func=_key_func,
    default_limits=[],  # tidak ada global limit; deklarasikan per-route
    # headers_enabled=False supaya slowapi tidak menuntut response Response
    # injection; status 429 sudah ditangani via exception handler kustom.
    headers_enabled=False,
)


def get_limit(kind: str) -> str:
    """Resolve string limit dari settings + flag enabled.

    ``kind`` ∈ {"predict", "recommendation"}.
    Bila ``rate_limit_enabled=False``, mengembalikan limit "extremely
    high" supaya decorator effectively no-op.
    """
    s = get_settings()
    if not s.rate_limit_enabled:
        return "10000/second"
    return {
        "predict": s.rate_limit_predict,
        "recommendation": s.rate_limit_recommendation,
    }.get(kind, "60/minute")
