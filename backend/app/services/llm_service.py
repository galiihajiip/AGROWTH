"""Gemini LLM service untuk rekomendasi pertanian hybrid Pranata Mangsa.

Menggunakan SDK ``google-genai`` (paling baru) dengan model ``gemini-2.5-flash``.
Mendukung:

- Konfigurasi via ``pydantic-settings`` (``GEMINI_API_KEY`` dari env / ``.env``)
- ``build_recommendation_prompt`` → format konteks cuaca + mangsa + skema JSON
- ``generate_recommendation`` async → call Gemini, parse JSON terstruktur
- ``_fallback_recommendation`` statis dari ``MangsaInfo`` + warning per ``RiskLevel``
- TTL cache manual 300 detik dengan key ``(lat, lon, mangsa.number, risk_level)``
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, ValidationError

from app.core import get_settings
from app.models import (
    AnomalyType,
    ForecastPoint,
    LocationInfo,
    MangsaInfo,
    RiskLevel,
    WeatherCurrent,
)
from app.services.pranata_mangsa import match_crops_to_mangsa

logger = logging.getLogger(__name__)


# ---------- LLM output schema ----------

class RecommendationLLM(BaseModel):
    """Struktur JSON keluaran LLM (sumber rekomendasi naratif)."""

    traditional_wisdom: str = Field(..., description="Kearifan lokal Pranata Mangsa")
    modern_action: List[str] = Field(
        default_factory=list, description="Tindakan modern terukur (3-5 item)"
    )
    crop_recommendation: List[str] = Field(
        default_factory=list, description="Tanaman yang direkomendasikan (max 5)"
    )
    warning: List[str] = Field(
        default_factory=list, description="Peringatan risiko relevan"
    )
    narrative: str = Field(..., description="Narasi 80-120 kata Bahasa Jawa")
    mangsa_greeting: str = Field(
        default="",
        description="Sapaan pembuka Jawa krama terkait mangsa aktif",
    )
    traditional_proverb: str = Field(
        default="",
        description="Peribahasa/ungkapan Jawa relevan dengan kondisi anomali",
    )


# ---------- TTL cache (manual) ----------

_CacheKey = Tuple[float, float, int, str, Optional[str], Optional[str]]
_CACHE: Dict[_CacheKey, Tuple[float, RecommendationLLM]] = {}


def _cache_key(
    lat: float,
    lon: float,
    mangsa: MangsaInfo,
    risk_level: RiskLevel,
    crop_type: Optional[str] = None,
    planting_date: Optional[date] = None,
) -> _CacheKey:
    """Cache key gabungan koordinat + mangsa + risiko + konteks petani."""
    return (
        round(lat, 2),
        round(lon, 2),
        mangsa.number,
        risk_level.value,
        (crop_type or "").lower().strip() or None,
        planting_date.isoformat() if planting_date else None,
    )


def _cache_get(key: _CacheKey) -> Optional[RecommendationLLM]:
    entry = _CACHE.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.monotonic() >= expires_at:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: _CacheKey, value: RecommendationLLM) -> None:
    ttl = get_settings().gemini_cache_ttl_sec
    _CACHE[key] = (time.monotonic() + ttl, value)


def clear_cache() -> None:
    """Bersihkan TTL cache (dev/test)."""
    _CACHE.clear()


# ---------- Gemini client ----------

_client: Optional[Any] = None


def _get_client() -> Optional[Any]:
    """Lazy-init Gemini client. ``None`` bila API key kosong / SDK absen."""
    global _client
    if _client is not None:
        return _client

    s = get_settings()
    if not s.gemini_api_key:
        logger.info("GEMINI_API_KEY kosong; LLM fallback aktif.")
        return None

    try:
        from google import genai  # type: ignore[import-not-found]
    except ImportError:
        logger.warning("Paket google-genai belum terpasang; LLM fallback aktif.")
        return None

    _client = genai.Client(api_key=s.gemini_api_key)
    return _client


def reset_client() -> None:
    """Reset client (dev/test, mis. setelah ganti API key)."""
    global _client
    _client = None


# ---------- Prompt builder ----------

def _format_forecast(forecast: List[ForecastPoint]) -> str:
    return "\n".join(
        f"- {f.date.isoformat()}: {f.temp_min_c}-{f.temp_max_c}°C, "
        f"hujan {f.rainfall_mm} mm, kelembapan {f.humidity_pct}%, "
        f"angin {f.wind_speed_ms} m/s, {f.condition}"
        for f in forecast
    )


def _format_farmer_context(
    crop_type: Optional[str],
    planting_date: Optional[date],
    notes: Optional[str],
) -> str:
    """Bagian ``KONTEKS PETANI`` di prompt — kosong bila tidak ada input."""
    items: List[str] = []
    if crop_type:
        items.append(f"- Tanaman utama: {crop_type}")
    if planting_date:
        items.append(f"- Tanggal tanam: {planting_date.isoformat()}")
    if notes:
        notes_clean = notes.strip().replace("\n", " ")
        items.append(f"- Catatan petani: {notes_clean}")
    if not items:
        return ""
    return "\n== KONTEKS PETANI ==\n" + "\n".join(items) + "\n"


def build_recommendation_prompt(
    weather: WeatherCurrent,
    forecast: List[ForecastPoint],
    mangsa: MangsaInfo,
    risk_level: RiskLevel,
    anomaly: AnomalyType,
    location: LocationInfo,
    crop_type: Optional[str] = None,
    planting_date: Optional[date] = None,
    notes: Optional[str] = None,
) -> str:
    """Format prompt: persona + cuaca + mangsa + konteks petani + instruksi JSON output."""
    lokasi = (
        location.name
        or location.province
        or f"{location.lat:.3f},{location.lon:.3f}"
    )
    farmer_block = _format_farmer_context(crop_type, planting_date, notes)
    tanda_alam_pertama = mangsa.characteristics[0] if mangsa.characteristics else "-"
    return f"""== PERSONA ==
Kamu adalah Mbah Tani Digital — penasihat pertanian yang menguasai ilmu cuaca modern \
DAN hafal seluruh 12 Pranata Mangsa beserta tanda alamnya. Bicaramu hangat, \
menggunakan krama alus Jawa namun tetap mudah dipahami. Ing wektu menika, \
tugasmu nggawe rekomendasi tindakan kanggo petani ing lokasi {lokasi} \
(lat {location.lat}, lon {location.lon}).

== KONTEKS CUACA SAIKI ==
- Suhu: {weather.temperature_c}°C
- Kelembapan: {weather.humidity_pct}%
- Curah hujan: {weather.rainfall_mm} mm
- Angin: {weather.wind_speed_ms} m/s
- Kondisi: {weather.condition}

== PRAKIRAAN 7 DINA ==
{_format_forecast(forecast)}

== MANGSA AKTIF ==
- Mangsa: {mangsa.name} (mangsa ke-{mangsa.number})
- Periode: {mangsa.period_start} s.d. {mangsa.period_end} ({mangsa.duration_days} dina)
- Musim umum: {mangsa.season}
- Watak alam: {mangsa.description}
- Tandha alam: {"; ".join(mangsa.characteristics) or "-"}
- Tandha alam utama: {tanda_alam_pertama}
- Pangrasa tradhisi: {"; ".join(mangsa.recommended_activities) or "-"}

== ANALISIS RISIKO ==
- Tingkat risiko: {risk_level.value}
- Anomali iklim: {anomaly.value}
{farmer_block}
== INSTRUKSI OUTPUT ==
Jawaben MUNG nganggo JSON valid (tanpa markdown fence, tanpa tembung tambahan).
Schema:
{{
  "traditional_wisdom": "<kearifan lokal Pranata Mangsa, 1-2 ukara basa Jawa krama lugu>",
  "modern_action": ["<langkah modern 1>", "<langkah 2>", "<langkah 3>", "..."],
  "crop_recommendation": ["<tanaman 1>", "<tanaman 2>", "..."],
  "warning": ["<peringatan 1>", "<peringatan 2>", "..."],
  "narrative": "<narasi 80-120 tembung basa Jawa>",
  "mangsa_greeting": "<1 ukara sapaan Jawa krama terkait mangsa aktif>",
  "traditional_proverb": "<1 peribahasa/ungkapan Jawa relevan karo anomali {anomaly.value}>"
}}

Aturan tambahan:
- "modern_action" 3-5 item; ringkes lan iso ditindakaké petani.
  Ing wektu menika, miturut kawruh leluhur, gunakna frasa Jawa sing hangat
  (umpamané "Ing wektu menika", "Miturut kawruh leluhur") tinimbang tembung
  generik kaya "Sebaiknya" utawa "Disarankan".
- "crop_recommendation" max 5 item; prioritas tanaman cocok mangsa+anomali.
  Yen petani wis nyebutake tanaman utama (KONTEKS PETANI), prioritasake
  varietas/nawala kanggo tanaman kuwi.
- "warning" 1-3 item; selaras karo tingkat risiko ({risk_level.value}).
- "narrative" wajib basa Jawa krama lugu, 80-120 tembung, padu antara
  tradisi lan praktik modern. WAJIB nyebut jeneng mangsa "{mangsa.name}"
  minimal 2 kali lan nyebut tandha alam "{tanda_alam_pertama}" minimal
  1 kali ing narasi. Yen tanggal tanam diwenehake, lebokake estimasi fase
  tanduran (vegetatif/generatif/panen).
- "mangsa_greeting" sapaan 1 ukara Jawa krama kanggo petani, nyebut mangsa
  aktif (conto: "Kulo nuwun, sedulur tani ing mangsa {mangsa.name} menika...").
- "traditional_proverb" 1 peribahasa utawa ungkapan Jawa sing gathuk karo
  anomali {anomaly.value} saiki (conto: "Sapa nandur bakal ngundhuh").

== CONTO (FEW-SHOT) ==
Input: Mangsa Kasa (mangsa ke-1), anomali drought, risiko medium, suhu 33°C.
Output:
{{
  "traditional_wisdom": "Ing mangsa Kasa, godhong jati lan randu wiwit gogrog, pratandha ketiga wiwit tumeka. Miturut kawruh leluhur, wektu iki becike nyimpen banyu lan ngirit sumber daya.",
  "modern_action": [
    "Ing wektu menika, pasang mulsa kanggo njaga kalengeran lemah",
    "Miturut kawruh leluhur, gunakna irigasi tetes kanggo ngirit banyu",
    "Ing wektu menika, semprotna pupuk daun wayah esuk utawa sore",
    "Miturut kawruh leluhur, tanduran palawija sing tahan ketiga"
  ],
  "crop_recommendation": ["kacang tanah", "jagung hibrida", "kedelai", "wijen"],
  "warning": [
    "Risiko cuaca sedang; tandha alam godhong gogrog nandhakaké ketiga nyata",
    "Simpenen banyu — sumber tuk lan sumur bisa suda drastis"
  ],
  "narrative": "Kulo aturaken, sedulur tani, ing mangsa Kasa menika bumi nembe mlebet wektu ketiga. Mangsa Kasa ingkang kaping setunggal saking rolas mangsa Pranata Mangsa dipuntandhani kaliyan godhong jati lan randu ingkang sami gogrog — pratandha bilih udan sampun boten tumeka. Ing wektu menika, siti wiwit garing lan nelo. Miturut kawruh leluhur, wektu menika prayoginipun dipunginakaken kangge nanem palawija ingkang tahan ketiga kados kacang tanah lan jagung hibrida. Suhu ingkang dumugi 33°C ndadosaken penting sanget kangge njagi kalengeran lemah mawi mulsa lan irigasi tetes. Mugi-mugi mangsa Kasa menika paring berkah lan asil ingkang sae.",
  "mangsa_greeting": "Kulo nuwun, sedulur tani ing mangsa Kasa menika, mugi tansah pinaringan wilujeng.",
  "traditional_proverb": "Sapa sing tlaten ngopeni lemah ing mangsa ketiga, bakal ngundhuh berkah ing mangsa rendheng."
}}"""


# ---------- Generation ----------

def _strip_json_fences(text: str) -> str:
    """Bersihkan ```json ... ``` fence bila LLM ngirim markdown."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
    if t.endswith("```"):
        t = t[: -3]
    return t.strip()


def _parse_llm_json(raw: str) -> RecommendationLLM:
    """Parse string JSON mentah → ``RecommendationLLM`` (raise on invalid)."""
    cleaned = _strip_json_fences(raw)
    data = json.loads(cleaned)
    return RecommendationLLM.model_validate(data)


async def _call_gemini(prompt: str) -> str:
    """Async call ke Gemini, kembalikan teks mentah."""
    client = _get_client()
    if client is None:
        raise RuntimeError("Gemini client tidak tersedia")

    s = get_settings()
    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model=s.gemini_model,
            contents=prompt,
            config={
                "temperature": s.gemini_temperature,
                "response_mime_type": "application/json",
            },
        ),
        timeout=s.gemini_timeout_sec,
    )
    text = getattr(response, "text", None)
    if not text:
        raise RuntimeError("Gemini response kosong")
    return text


# ---------- Fallback statis ----------

_RISK_WARNING_BASE: Dict[RiskLevel, List[str]] = {
    RiskLevel.LOW: [
        "Risiko cuaca rendah; lanjutkan pemantauan harian sawah dan kebun.",
    ],
    RiskLevel.MEDIUM: [
        "Risiko cuaca sedang; pantau prakiraan tiap pagi.",
        "Siapkan saluran drainase dan sumber air cadangan.",
    ],
    RiskLevel.HIGH: [
        "Risiko cuaca tinggi; tinjau ulang jadwal tanam/panen.",
        "Amankan stok benih dan pupuk dari paparan cuaca ekstrem.",
        "Koordinasi dengan kelompok tani dan penyuluh setempat.",
    ],
    RiskLevel.CRITICAL: [
        "Risiko cuaca KRITIS: tunda aktivitas tanam baru.",
        "Perkuat tanggul, pematang, dan saluran air.",
        "Siapkan rencana evakuasi alat, ternak, dan logistik.",
        "Pantau peringatan BMKG/instansi lokal tiap jam.",
    ],
}

_ANOMALY_WARNING_EXTRA: Dict[AnomalyType, List[str]] = {
    AnomalyType.DROUGHT: [
        "Hemat air; gunakan mulsa dan irigasi tetes bila memungkinkan.",
    ],
    AnomalyType.FLOOD: [
        "Pastikan drainase lancar; simpan benih di tempat tinggi/kering.",
    ],
    AnomalyType.HEATWAVE: [
        "Lindungi tanaman muda dengan naungan; siram pagi dan sore.",
    ],
    AnomalyType.EL_NINO: [
        "Antisipasi kemarau panjang; perpanjang siklus simpan air.",
    ],
    AnomalyType.LA_NINA: [
        "Antisipasi hujan ekstra; perkuat tanggul dan pematang.",
    ],
    AnomalyType.NORMAL: [],
}

_ANOMALY_PROVERB: Dict[AnomalyType, str] = {
    AnomalyType.DROUGHT: (
        "Banyu iku nyawané tanduran; sing sapa bisa nyimpen, "
        "bakal ngundhuh ing mangsa ketiga."
    ),
    AnomalyType.FLOOD: (
        "Yen banjir teka, sing waspada urip slamet; "
        "sing sapa nata kali, ora bakal kelangan pari."
    ),
    AnomalyType.HEATWAVE: (
        "Srengenge kang kepanasen iku pacoban; "
        "tanduran sing dikayomi bakal tetep ngrembaka."
    ),
    AnomalyType.EL_NINO: (
        "Ketiga dawa iku ujian kesabaran; "
        "sapa tlaten ngopeni lemah, bakal nampa ganjaran."
    ),
    AnomalyType.LA_NINA: (
        "Udan kang tanpa kendhat iku berkah lan bebaya; "
        "sing sapa wicaksana nata banyu, panenipun lestari."
    ),
    AnomalyType.NORMAL: (
        "Sapa nandur bakal ngundhuh; "
        "alam kang tentrem iku kanca sejatining tani."
    ),
}


def _fallback_recommendation(
    mangsa: MangsaInfo,
    risk_level: RiskLevel,
    anomaly: AnomalyType,
) -> RecommendationLLM:
    """Rekomendasi statis berbasis ``MangsaInfo`` + risk + anomali (tanpa LLM)."""
    crops = match_crops_to_mangsa(mangsa, anomaly)
    actions = list(mangsa.recommended_activities)[:5]
    if not actions:
        actions = [
            "Pantau kondisi sawah dan ladang setiap pagi.",
            "Siapkan benih, pupuk, dan alat sesuai mangsa.",
            "Catat kejadian alam (hujan, hama, suhu) sebagai bahan evaluasi.",
        ]

    warnings: List[str] = list(_RISK_WARNING_BASE.get(risk_level, []))
    warnings.extend(_ANOMALY_WARNING_EXTRA.get(anomaly, []))
    if not warnings:
        warnings = ["Pantau kondisi cuaca tiap pagi dan sore."]

    wisdom = (
        f"Mangsa {mangsa.name} ({mangsa.period_start}–{mangsa.period_end}) "
        f"nelakaké musim {mangsa.season}: {mangsa.description}"
    )

    tanda_alam_pertama = (
        mangsa.characteristics[0] if mangsa.characteristics else "-"
    )
    crop_phrase = ", ".join(crops[:3]) if crops else "palawija umum"
    action_phrase = "; ".join(actions[:3])
    narrative = (
        f"Kulo aturaken, sedulur tani, ing mangsa {mangsa.name} menika "
        f"bumi nembe mlebet musim {mangsa.season}. "
        f"Mangsa {mangsa.name} ingkang kaping {mangsa.number} saking rolas "
        f"mangsa Pranata Mangsa dipuntandhani kaliyan {tanda_alam_pertama}. "
        f"Ing wektu menika, tindakan utama ingkang dipunanjuraken inggih menika: "
        f"{action_phrase}. "
        f"Tanduran ingkang pas kangge wektu menika: {crop_phrase}. "
        f"Miturut kawruh leluhur, tingkat risiko cuaca {risk_level.value} "
        f"kanthi anomali {anomaly.value}; para tani dipunsuwun ngatos-atos "
        f"lan tetep mirengaken tandha alam ing sakiwa-tengenipun supados "
        f"panen lestari."
    )

    greeting = (
        f"Kulo nuwun, sedulur tani ing mangsa {mangsa.name} menika, "
        f"mugi tansah pinaringan wilujeng lan berkah."
    )
    proverb = _ANOMALY_PROVERB.get(
        anomaly,
        "Sapa nandur bakal ngundhuh; alam kang tentrem iku kanca sejatining tani.",
    )

    return RecommendationLLM(
        traditional_wisdom=wisdom,
        modern_action=actions,
        crop_recommendation=crops,
        warning=warnings,
        narrative=narrative,
        mangsa_greeting=greeting,
        traditional_proverb=proverb,
    )


# ---------- Public API ----------

async def generate_recommendation(
    weather: WeatherCurrent,
    forecast: List[ForecastPoint],
    mangsa: MangsaInfo,
    risk_level: RiskLevel,
    anomaly: AnomalyType,
    location: LocationInfo,
    crop_type: Optional[str] = None,
    planting_date: Optional[date] = None,
    notes: Optional[str] = None,
) -> RecommendationLLM:
    """Generate rekomendasi via Gemini dengan TTL cache + fallback.

    Cache key: ``(lat~2dp, lon~2dp, mangsa.number, risk_level.value,
    crop_type_norm, planting_date_iso)``; TTL default 300 detik.

    ``notes`` tidak masuk cache key (free text yang bervariasi tidak akan
    dapat cache hit) tapi tetap dipakai untuk membentuk prompt.
    """
    key = _cache_key(
        location.lat, location.lon, mangsa, risk_level, crop_type, planting_date,
    )
    cached = _cache_get(key)
    if cached is not None:
        return cached

    if _get_client() is None:
        result = _fallback_recommendation(mangsa, risk_level, anomaly)
        _cache_set(key, result)
        return result

    prompt = build_recommendation_prompt(
        weather=weather,
        forecast=forecast,
        mangsa=mangsa,
        risk_level=risk_level,
        anomaly=anomaly,
        location=location,
        crop_type=crop_type,
        planting_date=planting_date,
        notes=notes,
    )

    try:
        raw = await _call_gemini(prompt)
        result = _parse_llm_json(raw)
    except (
        asyncio.TimeoutError,
        RuntimeError,
        ValueError,
        ValidationError,
        json.JSONDecodeError,
    ) as exc:
        logger.warning("Gemini gagal (%s); pakai fallback statis.", exc)
        result = _fallback_recommendation(mangsa, risk_level, anomaly)
    except Exception as exc:  # last-resort guard untuk error tak terduga
        logger.exception("Gemini error tak terduga: %s", exc)
        result = _fallback_recommendation(mangsa, risk_level, anomaly)

    _cache_set(key, result)
    return result
