---
title: AGROWTH Backend
emoji: 🌾
colorFrom: green
colorTo: yellow
sdk: docker
pinned: false
---

# 🌾 AGROWTH
## Applied Generative Reasoning for Optimal Weather & Traditional Harvest

> **Sistem rekomendasi pertanian hibrida untuk Pulau Jawa** yang memadukan kearifan lokal
> tradisional (**Pranata Mangsa**), prediksi cuaca real-time, machine learning ensemble,
> dan narasi AI berbahasa Jawa via Google Gemini untuk mendukung keputusan tanam petani.

[![Backend tests](https://img.shields.io/badge/backend%20tests-170%20passed-brightgreen)]() [![Frontend](https://img.shields.io/badge/next-16.2.4-black?logo=next.js)]() [![Python](https://img.shields.io/badge/python-3.12-blue?logo=python)]() [![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 🎯 Visi & Misi

**Visi:** Memberdayakan petani Jawa dengan teknologi intelijen iklim yang menggabungkan
warisan pertanian tradisional dengan data real-time dan machine learning.

**Misi:** Menyediakan platform akses terbuka yang membantu petani membuat keputusan tanam
berbasis:
- **Kalender pertanian tradisional** (Pranata Mangsa 12 mangsa)
- **Data cuaca terintegrasi** (BMKG, NASA POWER, Open-Meteo)
- **Prediksi ML ensemble** (Random Forest, Gradient Boosting, SVM)
- **Narasi AI berbahasa Jawa** untuk relevansi budaya lokal

---

## ✨ Fitur Utama

### 📍 Dashboard Interaktif
- **Peta Interaktif Pulau Jawa** (Mapbox GL) dengan geolokasi real-time
- **7 Kartu informasi terintegrasi:**
  - Informasi Lokasi (nama, koordinat, status)
  - ML Predictive Variables (suhu, kelembapan, radiasi matahari, emisi GRK)
  - Rekomendasi AI Hibrida (Pranata Mangsa + prediksi + narasi Gemini)
  - Mangsa Aktif & Rekalibrasi (perbandingan tradisional vs ML)
  - Risiko Iklim dengan penjelasan ilmiah
  - Dashboard Intelijen Musiman 3 bulan

### 🤖 Machine Learning Pipeline
- **Ensemble anomali & risk classification** (Random Forest, Gradient Boosting, SVM)
- **Multi-source data normalization:**
  - BMKG (baseline historis 10 tahun)
  - NASA POWER (radiasi matahari, kelembapan)
  - Open-Meteo (cuaca real-time, forecast 14 hari)
  - Emisi GRK regional (proxy ENSO/iklim global)
- **Automatic model training & versioning** saat startup

### 🌾 Pranata Mangsa Engine
- **12 mangsa** lengkap dengan karakteristik, penanda alam, rekomendasi tradisional
- **Crop recommendation per anomaly** (crop matcher khusus kekeringan/banjir/normal)
- **Natural signs lookup** dengan narasi Jawa tradisional
- **Automatic calibration** antara ekspektasi tradisional vs prediksi ML

### 🗓️ Prediksi & Forecast
- **Cuaca harian 1–14 hari** dengan confidence intervals
- **Seasonal Intelligence Dashboard** (7 hari / 30 hari / 3 bulan)
- **Optimal planting windows** berdasarkan rainfall & temperature baseline
- **Anomaly detection** (El Niño, La Niña, drought, flood, heatwave)

### 📡 Kerentanan Wilayah (Vulnerability Mapping)
- **Heatmap grid 0.25–1° resolusi** untuk risk assessment spasial
- **Static markers 10 kabupaten rentan** (Dewanti et al., 2024)
- **Interactive popover** dengan severitas banjir/kekeringan
- **Animated overlay** dengan toggle on/off

### 🎨 User Experience
- **Theme toggle** (dark/light mode) dengan tema glassmorphism
- **Responsive design** (mobile-first, optimized untuk tablet/desktop)
- **Error boundary & graceful fallback** (mock weather, statis recommendation)
- **Global toast notifications** untuk feedback status real-time
- **Framer motion animations** untuk entrance & transitions halus
- **In-map status chip** untuk visual confirmation koordinat terpilih

### 🔐 API & Security
- **SlowAPI rate limiting** per-IP (60/min predict, 20/min recommendation)
- **CORS policy** terkonfigurasi untuk environment (dev/prod)
- **Request ID tracing** (X-Request-ID header) untuk observability
- **Pydantic validation** penuh di backend, TypeScript di frontend

### 🧪 Testing & Quality
- **170+ unit/E2E tests** (pytest, vitest)
- **CI-ready** (test + lint + type-check)
- **Docker multi-stage build** untuk production

---

## 🚀 Quick Start

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

### Stack Teknologi

| Layer | Teknologi | Versi |
|---|---|---|
| **Backend** | FastAPI + Uvicorn + Pydantic | Python 3.12 |
| **ML** | scikit-learn + joblib | 1.3+ |
| **Database** | In-memory (Pranata Mangsa JSON) | — |
| **Frontend** | Next.js App Router + React + Zustand | 16.2.4, 19.2.5 |
| **UI/Styling** | Tailwind CSS + Framer Motion + Lucide | 3.4.19 |
| **Maps** | Mapbox GL + react-map-gl | 7.1.7 |
| **Charts** | Recharts | 2.15.4 |
| **Validation** | TypeScript + Pydantic | 5.9.3 |
| **Deployment** | Docker + docker-compose | 24+ |
| **Testing** | pytest + vitest | 170+ tests |

---

## 🔧 Instalasi

### Docker (Recommended)

Prasyarat: Docker Desktop ≥ 24, dan token public Mapbox (gratis, daftar di
[account.mapbox.com](https://account.mapbox.com/access-tokens/)).

```bash
# 1) Clone repository
git clone https://github.com/galiihajiip/AGROWTH.git
cd AGROWTH

# 2) Konfigurasi environment
cp backend/.env.example backend/.env                 # Edit GEMINI_API_KEY (opsional)
cp frontend/.env.local.example frontend/.env.local   # Set NEXT_PUBLIC_MAPBOX_TOKEN (wajib)

# 3) Eksport Mapbox token
export NEXT_PUBLIC_MAPBOX_TOKEN="pk.your_mapbox_public_token"

# 4) Jalankan
docker compose up --build
```

**Endpoints:**
- 🎨 **Dashboard UI:** http://localhost:3000
- 🔌 **Backend API:** http://localhost:8000
- 📚 **API Docs:** http://localhost:8000/docs
- 💚 **Health Check:** http://localhost:8000/health

**Berhenti:** `Ctrl+C` → `docker compose down`

### Backend

```bash
cd backend

# Setup
python -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure
cp .env.example .env                   # Edit GEMINI_API_KEY (opsional)

# Run
uvicorn main:app --reload --port 8000
```

**Testing:**
```bash
pytest -q                              # Jalankan 170+ tests
pytest -q tests/test_pranata_mangsa.py -k boundary  # Filter specific tests
pytest --cov=app                       # Coverage report
```

### Frontend

```bash
cd frontend

# Setup
npm install

# Configure
cp .env.local.example .env.local       # Set NEXT_PUBLIC_MAPBOX_TOKEN (wajib)

# Run
npm run dev                            # Dev server at http://localhost:3000
```

**Quality checks:**
```bash
npm run type-check                     # TypeScript validation
npm run lint                           # ESLint
npm run build                          # Production build
npm run test                           # Unit tests (vitest)
```

---

## 📊 Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                       │
├──────────────────────────────────────────────────────────────┤
│  MapView (Mapbox GL) ──click──> Zustand Store ──fetch──┐     │
│  7 Dashboard Cards (React)         + Local State       │     │
│  Theme Toggle, Responsive Layout                       │     │
└──────────────────────────────────────────────────────────────┘
                                                         │
                                    POST /api/recommendation
                                                         │
                                                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  BACKEND (FastAPI + Uvicorn)                 │
├──────────────────────────────────────────────────────────────┤
│  ✓ Request ID tracing (middleware)                           │
│  ✓ Rate limiting (SlowAPI)                                   │
│  ✓ CORS policy enforcement                                   │
│                                                              │
│  Routers:                                                    │
│  ├─ /api/predict (weather + ML classification)              │
│  ├─ /api/recommendation (hybrid: weather + mangsa + LLM)    │
│  ├─ /api/mangsa/* (lookup Pranata Mangsa)                   │
│  ├─ /api/vulnerability/grid (spatial heatmap)               │
│  └─ /health (status check)                                  │
│                                                              │
│  Services:                                                   │
│  ├─ Pranata Mangsa Engine (12 mangsa, crop matcher)         │
│  ├─ Weather Aggregator (BMKG + NASA POWER + Open-Meteo)    │
│  ├─ ML Pipeline (ensemble classifiers)                      │
│  ├─ LLM Service (Gemini + TTL cache + fallback)             │
│  └─ Data Source Registry                                    │
└──────────────────────────────────────────────────────────────┘
           │              │                 │
           ▼              ▼                 ▼
     ┌──────────┐  ┌────────────┐  ┌──────────────┐
     │   BMKG   │  │ NASA POWER │  │ Open-Meteo   │
     │(baseline)│  │(solar rad) │  │(real-time)   │
     └──────────┘  └────────────┘  └──────────────┘
```

### Key Components

| Module | Deskripsi |
|---|---|
| `backend/app/services/pranata_mangsa.py` | Engine 12 mangsa, lookup by date, crop matcher per anomaly |
| `backend/app/services/weather_service.py` | Orchestrator weather provider dengan fallback otomatis |
| `backend/app/ml/predictor.py` | ML ensemble (RF, GB, SVM) + auto-train pada load |
| `backend/app/services/llm_service.py` | Gemini API caller + TTL cache + fallback rule-based |
| `backend/app/core/rate_limit.py` | SlowAPI limiter configuration per-endpoint |
| `frontend/store/useAgrowthStore.ts` | Zustand global state (coord, recommendation, mangsa, error) |
| `frontend/components/map/MapView.tsx` | Mapbox GL canvas + click handler → setCoordinate |
| `frontend/components/dashboard/ForecastChartCard.tsx` | Seasonal intelligence 7d/30d/3m view |
| `frontend/lib/forecast-utils.ts` | Seasonal data generation + planting window calculator |

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

---

## � Konfigurasi Environment

### Backend (`.env`)

| Variable | Default | Deskripsi |
|---|---|---|
| `GEMINI_API_KEY` | (kosong) | API key Google Gemini (opsional, fallback ke rule-based) |
| `ENVIRONMENT` | `development` | `development` atau `production` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | CORS whitelist |
| `RATE_LIMIT_PREDICT` | `60` | Requests per menit untuk `/predict` |
| `RATE_LIMIT_RECOMMEND` | `20` | Requests per menit untuk `/recommendation` |

### Frontend (`.env.local`)

| Variable | Default | Deskripsi |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | (wajib) | Public token Mapbox GL |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend endpoint |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | `60000` | Request timeout (ms), configurable |

**Catatan:** Environment variables frontend harus diprefix `NEXT_PUBLIC_` untuk
visible di browser.

---

## �👥 Developer Team

| Nama | Role | Expertise |
|---|---|---|
| 1. _______________ | Backend Lead / ML | Python, FastAPI, scikit-learn |
| 2. _______________ | Frontend Lead / UI | Next.js, React, Tailwind, Maps |
| 3. _______________ | Data & Integration | Weather APIs, Data validation |
| 4. _______________ | QA & DevOps | Testing, Docker, CI/CD |

---

## 📄 Lisensi

MIT License. Sumber data Pranata Mangsa berbasis dokumentasi historis publik,
kode & abstraksi disediakan apa adanya.
