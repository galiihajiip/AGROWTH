# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build deps ----------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install ke prefix terpisah supaya bisa di-COPY ke runtime image yang tipis.
COPY requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt


# ---------- Stage 2: runtime ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENVIRONMENT=production \
    LOG_LEVEL=INFO

WORKDIR /app

# Non-root user untuk runtime.
RUN useradd --create-home --shell /bin/bash agrowth

# Salin dependency dari builder.
COPY --from=builder /install /usr/local

# Salin kode aplikasi.
COPY --chown=agrowth:agrowth . /app

USER agrowth

EXPOSE 8000

# Healthcheck: hit endpoint /health (dijaga ringan oleh app).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=3)" || exit 1

# Pakai uvicorn langsung (bukan gunicorn+uvicorn) untuk simplicity demo.
# Tambah --workers > 1 di compose/k8s bila CPU-bound.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
