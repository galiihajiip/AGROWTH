"""Global exception handlers untuk FastAPI app AGROWTH.

Memberi format error JSON yang konsisten dan menerjemahkan exception
domain (``ValueError``, ``KeyError``) menjadi status HTTP yang relevan
sehingga tidak bocor sebagai **500 Internal Server Error**.

Semua respon error mengikuti shape:

::

    {"detail": "<pesan>", "code": "<kode_singkat>"}

dan menyertakan header ``X-Request-ID`` (di-set oleh middleware) supaya
mudah ditelusuri di log.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger("agrowth.error")


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "-")


def _error_payload(detail: str, code: str) -> Dict[str, Any]:
    return {"detail": detail, "code": code}


async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """``ValueError`` dari layer service → **422 Unprocessable Entity**."""
    logger.warning(
        "request_id=%s ValueError on %s: %s",
        _request_id(request), request.url.path, exc,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_payload(str(exc), "value_error"),
    )


async def key_error_handler(request: Request, exc: KeyError) -> JSONResponse:
    """``KeyError`` dari layer service → **404 Not Found**.

    KeyError biasanya menandakan resource (mangsa id, dsb.) tidak ada;
    bukan kesalahan server. Mapping ke 404 adalah default yang masuk akal.
    Router yang butuh perilaku lain harus handle KeyError-nya sendiri.
    """
    detail = exc.args[0] if exc.args else "resource tidak ditemukan"
    logger.info(
        "request_id=%s KeyError on %s: %s",
        _request_id(request), request.url.path, detail,
    )
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=_error_payload(str(detail), "not_found"),
    )


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Fallback untuk exception tak terduga → **500 Internal Server Error**.

    Menyembunyikan stacktrace dari klien tapi tetap mencatatnya secara
    lengkap di log dengan ``request_id`` agar bisa ditrack.
    """
    logger.exception(
        "request_id=%s Unhandled %s on %s: %s",
        _request_id(request), type(exc).__name__, request.url.path, exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_payload(
            "Terjadi kesalahan internal pada server.", "internal_error",
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Daftarkan semua handler ke instance FastAPI."""
    app.add_exception_handler(ValueError, value_error_handler)
    app.add_exception_handler(KeyError, key_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
