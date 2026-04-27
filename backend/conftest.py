"""pytest config root untuk backend AGROWTH.

Kehadiran file ini membuat ``backend/`` menjadi rootdir pytest secara otomatis,
sehingga ``main`` dan ``app.*`` dapat di-import langsung dalam test tanpa
mem-prefix path manual.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Pastikan direktori backend/ ada di sys.path (idempotent).
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
