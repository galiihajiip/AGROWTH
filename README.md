# AGROWTH

> Hybrid agriculture recommendation dashboard for Pulau Jawa.
> Memadukan **Pranata Mangsa** (kalender pertanian Jawa, 12 mangsa),
> prediksi cuaca/risk/anomaly, dan narasi LLM Bahasa Jawa via Google Gemini 2.5 Flash.

[![Backend tests](https://img.shields.io/badge/backend%20tests-170%20passed-brightgreen)]() [![Frontend build](https://img.shields.io/badge/next-16.2.4-black?logo=next.js)]() [![License](https://img.shields.io/badge/license-MIT-blue)]()

---

## Apa itu AGROWTH?

AGROWTH menjawab pertanyaan: _"Hari ini saya petani di koordinat (X, Y) di Jawa — apa
yang sebaiknya saya tanam? Apa risiko cuacanya? Apa kearifan Pranata Mangsa yang relevan?"_

Stack:

- **Backend** FastAPI (Python 3.12) — REST API + 3 service (mock weather, Pranata
  Mangsa engine, Gemini LLM) + slowapi rate limiting + 170 unit/E2E tests.
- **Frontend** Next.js 16 App Router + Tailwind + Zustand + Mapbox GL — peta
  interaktif Pulau Jawa, klik koordinat → fetch hybrid recommendation.

Cakupan saat ini: 12 mangsa lengkap, prediksi 1–14 hari, 6 anomaly type
(`normal`, `el_nino`, `la_nina`, `drought`, `flood`, `heatwave`), 4 risk level,
fallback statis bila Gemini API key tidak tersedia.

## Demo cepat (Docker, satu perintah)

Prasyarat: Docker Desktop ≥ 24, dan token public Mapbox (gratis, daftar di
[account.mapbox.com](https://account.mapbox.com/access-tokens/)).

```bash
# 1) Konfigurasi
cp backend/.env.example backend/.env                 # GEMINI_API_KEY (opsional)
cp frontend/.env.local.example frontend/.env.local   # NEXT_PUBLIC_MAPBOX_TOKEN (wajib)

# 2) Export Mapbox token agar terbaca compose build args
export NEXT_PUBLIC_MAPBOX_TOKEN="pk.your_mapbox_public_token"

# 3) Jalankan
docker compose up --build
```

Endpoints:
- Dashboard:        http://localhost:3000
- Backend API:      http://localhost:8000
- OpenAPI Swagger:  http://localhost:8000/docs
- Health:           http://localhost:8000/health

Hentikan: `Ctrl+C` lalu `docker compose down`.

## Development lokal

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # tweak GEMINI_API_KEY bila perlu
uvicorn main:app --reload --port 8000
```

Test:

```bash
pytest -q                  # 170 tests
pytest -q tests/test_pranata_mangsa.py -k boundary
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local                     # set NEXT_PUBLIC_MAPBOX_TOKEN
npm run dev
```

Verification chain:

```bash
npm run type-check && npm run lint && npm run build
```

## Arsitektur singkat

```
┌────────────────┐  click(lat,lon)   ┌─────────────────────────┐
│  MapView       │ ────────────────► │  useAgrowthStore        │
│  (Mapbox GL)   │                   │  setCoordinate(coord)   │
└────────────────┘                   │   └─► fetchRecommendation│
                                     └────┬────────────────────┘
                                          │ POST /api/recommendation
                                          ▼
                                ┌────────────────────────┐
                                │  FastAPI               │
                                │  (predict + mangsa     │
                                │   + Gemini fallback)   │
                                └────────────────────────┘
```

Detail kontrak schema: `backend/app/models/schemas.py` (Pydantic) ↔
`frontend/types/index.ts` (TypeScript). Keduanya diuji selaras 1:1.

### Komponen utama

| File | Tanggung jawab |
|---|---|
| `backend/app/services/pranata_mangsa.py` | 12 mangsa engine, lookup by date, crop matcher per anomaly |
| `backend/app/services/weather_mock.py` | Mock cuaca deterministik (seed = lat+lon+tanggal) |
| `backend/app/services/llm_service.py` | Gemini caller + TTL cache + fallback statis |
| `backend/app/core/rate_limit.py` | slowapi limiter per-IP, env-tunable |
| `frontend/store/useAgrowthStore.ts` | Zustand state (coord + recommendation + mangsa + error) |
| `frontend/components/map/MapView.tsx` | Mapbox GL canvas, click → setCoordinate |
| `frontend/components/feedback/ErrorToast.tsx` | Global error notification subscribed ke store |
| `frontend/app/error.tsx` | Next.js App Router error boundary |

## Endpoint utama

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/predict?days=1..14` | Cuaca + risk + anomaly untuk koordinat |
| `POST` | `/api/recommendation` | Hybrid (cuaca + mangsa + LLM, single-fetch ideal untuk UI) |
| `GET`  | `/api/mangsa/current` | Mangsa aktif hari ini |
| `GET`  | `/api/mangsa/all` | Daftar 12 mangsa |
| `GET`  | `/api/mangsa/{id}` | Detail per id (1..12) |
| `GET`  | `/api/mangsa/by-date?date=YYYY-MM-DD` | Mangsa pada tanggal arbitrer |
| `GET`  | `/health` | Health check + status LLM |

Validasi koordinat: **Pulau Jawa saja** (`lat ∈ [-9, -5]`, `lon ∈ [105, 115]`),
selain itu → `422`. Untuk contoh `curl` lengkap lihat
[CURL_EXAMPLES.md](./CURL_EXAMPLES.md).

## Konfigurasi

Semua via env file:

| Var | Default | Catatan |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:3000,...` | CSV; jangan di-JSON-kan |
| `GEMINI_API_KEY` | _empty_ | Tanpa key → fallback statis |
| `GEMINI_MODEL` | `gemini-2.5-flash` | |
| `GEMINI_CACHE_TTL_SEC` | `300` | TTL cache LLM per (lat,lon,mangsa,risk) |
| `RATE_LIMIT_ENABLED` | `true` | Set `false` untuk test/CI |
| `RATE_LIMIT_PREDICT` | `60/minute` | per-IP |
| `RATE_LIMIT_RECOMMENDATION` | `20/minute` | per-IP, lebih ketat (Gemini cost) |
| `LOG_LEVEL` | `INFO` | DEBUG/INFO/WARNING/ERROR |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend → backend base URL |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | _empty_ | **Wajib** untuk peta render |

## Pranata Mangsa: ringkas

Kalender pertanian tradisional Jawa, dikodifikasi oleh Sri Susuhunan Pakubuwana VII
(1855). 12 mangsa berbasis tahun matahari (365 hari):

| # | Nama | Periode | Musim |
|---|---|---|---|
| 1 | Kasa | 22 Jun – 1 Aug | Awal kemarau |
| 2 | Karo | 2 Aug – 24 Aug | Kemarau |
| 3 | Katiga | 25 Aug – 17 Sep | Puncak kemarau |
| 4 | Kapat | 18 Sep – 12 Oct | Pancaroba |
| 5 | Kalima | 13 Oct – 8 Nov | Awal hujan |
| 6 | Kanem | 9 Nov – 21 Dec | Hujan |
| 7 | Kapitu | 22 Dec – 2 Feb | Puncak hujan (wrap-around) |
| 8 | Kawolu | 3 Feb – 28/29 Feb | Hujan menurun |
| 9 | Kasanga | 1 Mar – 25 Mar | Akhir hujan |
| 10 | Kasadasa | 26 Mar – 18 Apr | Pancaroba |
| 11 | Desta | 19 Apr – 11 May | Panen raya |
| 12 | Sadha | 12 May – 21 Jun | Akhir panen |

Sumber data: [`backend/app/data/pranata_mangsa.json`](./backend/app/data/pranata_mangsa.json).

## Lisensi

MIT. Sumber data Pranata Mangsa berbasis dokumentasi historis publik, kode &
abstraksi disediakan apa adanya.
