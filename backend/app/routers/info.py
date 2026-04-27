"""Router informasi transparansi pipeline data AGROWTH.

Endpoint:
- ``GET /api/data-sources`` — registry lengkap sumber data + status integrasi.

Dirancang untuk menjawab pertanyaan juri hackathon tentang
autentisitas data dan roadmap integrasi ke sumber data real.
"""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter

from app.services.data_source_registry import get_registry_summary

router = APIRouter(prefix="/api", tags=["meta"])


@router.get(
    "/data-sources",
    summary="Registry sumber data & status integrasi pipeline.",
    response_model=None,
    responses={
        200: {
            "description": (
                "Daftar semua sumber data beserta status integrasi "
                "(active / mock / planned), endpoint asli, dan disclaimer."
            ),
        },
    },
)
async def data_sources() -> Dict[str, Any]:
    """Kembalikan registry lengkap sumber data AGROWTH.

    Response berisi:
    - ``demo_mode``: boolean, ``true`` saat ada field yang masih mock.
    - ``disclaimer``: penjelasan bahwa data disimulasikan untuk demo.
    - ``sources``: dict per field cuaca/fitur dengan metadata integrasi.
    """
    return get_registry_summary()
