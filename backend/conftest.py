"""pytest config root untuk backend AGROWTH.

Kehadiran file ini membuat ``backend/`` menjadi rootdir pytest secara otomatis,
sehingga ``main`` dan ``app.*`` dapat di-import langsung dalam test tanpa
mem-prefix path manual.

Juga men-disable rate limiting (slowapi) selama test supaya parametrize
tests yang memanggil endpoint berkali-kali tidak terkena 429 palsu.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Pastikan direktori backend/ ada di sys.path (idempotent).
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Set sebelum import settings/main supaya AppSettings.rate_limit_enabled
# false saat get_settings() di-cache pertama kali. Tidak override kalau
# user sudah set sendiri (mis. test khusus rate-limit).
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
