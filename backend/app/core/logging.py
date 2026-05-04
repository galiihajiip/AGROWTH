"""Konfigurasi logging dan middleware akses HTTP.

  dan menulis 1 baris log per request (method, path, status, duration_ms).
"""
from __future__ import annotations

import contextvars
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.settings import get_settings

# Menyimpan request_id saat ini per context (coroutine aman)
request_id_ctx_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)

class RequestIdFilter(logging.Filter):
    """Menambahkan atribut `request_id` ke record logging."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx_var.get()
        return True

_LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s [req:%(request_id)s] :: %(message)s"


def configure_logging() -> None:
    """Inisialisasi root logger berdasarkan ``AppSettings.log_level``.

    Aman dipanggil berulang (idempotent): root handler hanya ditambahkan
    jika belum ada agar uvicorn / pytest tidak menggandakan output.
    """
    settings = get_settings()
    root = logging.getLogger()
    level = getattr(logging, settings.log_level, logging.INFO)
    root.setLevel(level)
    
    # Apply filter ke root supaya turun temurun dapet atribut
    root.addFilter(RequestIdFilter())

    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        root.addHandler(handler)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware: tag tiap request dengan ``X-Request-ID`` + log singkat."""

    def __init__(self, app, *, header_name: str = "X-Request-ID") -> None:
        super().__init__(app)
        self.header_name = header_name
        self.logger = logging.getLogger("agrowth.access")

    async def dispatch(self, request: Request, call_next):
        # Reuse ID dari client (jika ada) supaya bisa lacak across systems.
        request_id = request.headers.get(self.header_name) or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        
        # Set context variable untuk log lain
        token = request_id_ctx_var.set(request_id)

        started = time.monotonic()
        try:
            response: Response = await call_next(request)
        except Exception:
            duration_ms = (time.monotonic() - started) * 1000
            self.logger.exception(
                "%s %s -> ERROR (%.1fms)",
                request.method, request.url.path, duration_ms,
            )
            raise
        finally:
            request_id_ctx_var.reset(token)

        duration_ms = (time.monotonic() - started) * 1000
        response.headers[self.header_name] = request_id
        self.logger.info(
            "%s %s -> %d (%.1fms)",
            request.method, request.url.path,
            response.status_code, duration_ms,
        )
        return response
