"""Router Pranata Mangsa (kalender pertanian Jawa).

Endpoint:
- ``GET /api/mangsa/current`` — mangsa aktif berdasarkan tanggal hari ini.
- ``GET /api/mangsa/all``     — daftar 12 mangsa secara berurutan.
- ``GET /api/mangsa/{id}``    — detail mangsa berdasarkan id (1..12).
  Mengembalikan **404 Not Found** bila id di luar 1..12.

Catatan urutan rute: rute statis (``/current``, ``/all``) didefinisikan
sebelum rute dinamis (``/{mangsa_id}``) untuk menghindari shadowing.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException, Path, status

from app.models import MangsaInfo
from app.services.pranata_mangsa import (
    get_current_mangsa,
    get_mangsa_by_id,
    list_all_mangsa,
)

router = APIRouter(prefix="/api/mangsa", tags=["mangsa"])


@router.get(
    "/current",
    response_model=MangsaInfo,
    summary="Mangsa aktif untuk tanggal hari ini.",
)
async def current_mangsa() -> MangsaInfo:
    """Kembalikan mangsa yang aktif pada tanggal hari ini.

    Wrap-around tahun (Kapitu, 22 Des – 2 Feb) ditangani di service layer.
    """
    return get_current_mangsa()


@router.get(
    "/all",
    response_model=List[MangsaInfo],
    summary="Seluruh 12 mangsa Pranata Mangsa Jawa.",
)
async def all_mangsa() -> List[MangsaInfo]:
    """Daftar lengkap 12 mangsa, urutan id 1..12."""
    return list_all_mangsa()


@router.get(
    "/{mangsa_id}",
    response_model=MangsaInfo,
    responses={
        200: {"description": "Mangsa ditemukan."},
        404: {"description": "Mangsa tidak ditemukan (id harus 1..12)."},
    },
    summary="Detail mangsa berdasarkan id.",
)
async def mangsa_by_id(
    mangsa_id: int = Path(..., description="Nomor mangsa (1..12)"),
) -> MangsaInfo:
    """Detail satu mangsa berdasarkan id; **404** bila id tidak ditemukan.

    Catatan: validasi range (1..12) sengaja diserahkan ke service layer
    supaya id di luar batas mengembalikan **404 Not Found**, bukan 422.
    """
    try:
        return get_mangsa_by_id(mangsa_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mangsa id={mangsa_id} tidak ditemukan",
        ) from exc
