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

[![Backend tests](https://img.shields.io/badge/backend%20tests-170%20passed-brightgreen)]() [![Next.js](https://img.shields.io/badge/next-16.2.4-black?logo=next.js)]() [![Python](https://img.shields.io/badge/python-3.12-blue?logo=python)]() [![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 🚀 Cara Menjalankan di Lokal (Step-by-Step)

> **Prasyarat:** Python 3.12+, Node.js ≥ 18.18, npm, Git.
> Token Mapbox **wajib** (gratis di [account.mapbox.com](https://account.mapbox.com/access-tokens/)).
> Gemini API Key **opsional** — tanpa key sistem tetap berjalan dengan fallback narasi statis.

### Langkah 1 — Clone Repository

```bash
git clone https://github.com/galiihajiip/AGROWTH.git
cd AGROWTH
```

---

### Langkah 2 — Jalankan Backend (FastAPI)

```bash
cd backend

# Buat virtual environment
python -m venv .venv

# Aktifkan virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (CMD):
.venv\Scripts\activate.bat
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Salin dan konfigurasi environment
cp .env.example .env
# Buka .env, isi GEMINI_API_KEY (opsional)
# Variabel lain sudah punya default yang benar untuk dev lokal

# Jalankan backend
uvicorn main:app --reload --port 8000
```

✅ Backend siap di: **http://localhost:8000**
📚 API Docs (Swagger): **http://localhost:8000/docs**
💚 Health check: **http://localhost:8000/health**

---

### Langkah 3 — Jalankan Frontend (Next.js)

Buka terminal **baru** (backend tetap berjalan di terminal pertama):

```bash
cd frontend

# Install dependencies
npm install

# Salin dan konfigurasi environment
cp .env.local.example .env.local
# Buka .env.local, isi nilai berikut:
#   NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxxxxxxx   ← WAJIB
#   NEXT_PUBLIC_API_URL=http://localhost:8000  ← sudah terisi default

# Jalankan frontend
npm run dev
```

✅ Dashboard siap di: **http://localhost:3000**

---

### Langkah 4 — Jalankan Landing Page (Opsional)

Buka terminal ketiga:

```bash
cd landing
npx serve .
# atau: python -m http.server 5500
```

✅ Landing page siap di: **http://localhost:3000** (serve default) atau **http://localhost:5500**

---

### Ringkasan Semua Service

| Service | URL | Keterangan |
|---|---|---|
| 🌐 **Landing Page** | http://localhost:5500 | Static HTML, opsional |
| 🎨 **Dashboard** | http://localhost:3000 | Next.js frontend |
| 🔌 **Backend API** | http://localhost:8000 | FastAPI |
| 📚 **API Docs** | http://localhost:8000/docs | Swagger UI |

---

### Alternatif: Docker (Single Command)

```bash
# Dari root repo
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Isi NEXT_PUBLIC_MAPBOX_TOKEN di frontend/.env.local

docker compose up --build
```

**Berhenti:** `Ctrl+C` → `docker compose down`

---

## 🎯 Tentang AGROWTH

AGROWTH menjawab pertanyaan: _"Saya petani di koordinat (X, Y) di Jawa — apa yang sebaiknya saya tanam? Apa risiko cuacanya? Apa kearifan Pranata Mangsa yang relevan?"_

**Visi:** Memberdayakan petani Jawa dengan teknologi intelijen iklim yang menggabungkan warisan pertanian tradisional dengan data real-time dan machine learning.

---

## ✨ Fitur Utama

### 📍 Dashboard Interaktif (7 Kartu Terintegrasi)

| Kartu | Deskripsi |
|---|---|
| **Peta Interaktif** | Mapbox GL Pulau Jawa — klik untuk pilih koordinat, tampil lokasi presisi (kelurahan/kecamatan/kabupaten/provinsi via reverse geocode Nominatim) |
| **Informasi Lokasi** | Hierarki lokasi real-time, koordinat presisi 4 desimal, timestamp update, tombol reset |
| **ML Predictive Variables** | Suhu, kelembapan, curah hujan, angin (sensor) + GHG, radiasi matahari, anomali historis, drought index (ML) — side-by-side dengan bar kontribusi model |
| **Rekomendasi AI** | Narasi Bahasa Jawa (Gemini AI) + tindakan praktis + tanaman direkomendasikan + sumber data terintegrasi |
| **Mangsa Aktif** | Pranata Mangsa saat ini, progress bar hari, rekalibrasi tradisional vs ML (2-kolom), penanda alam, alert transisi mangsa |
| **Risiko Iklim** | Gauge skor risiko, ENSO badge, breakdown faktor probabilistik, sparkline tren 30 hari |
| **Proyeksi Musiman 3 Bulan** | Chart full-width — tampilan 7 hari / 30 hari / 3 bulan dengan planting window optimal |

### 🤖 Machine Learning Pipeline
- **Ensemble 3 classifier** (Random Forest, Gradient Boosting, SVM) untuk anomali & risk
- **6 tipe anomali:** `normal`, `el_nino`, `la_nina`, `drought`, `flood`, `heatwave`
- **4 level risiko:** `low`, `medium`, `high`, `critical`
- **Auto-train** saat startup, **versioning** model otomatis
- **Multi-source features:** BMKG baseline 10yr, NASA POWER solar radiation, Open-Meteo real-time, GHG emission proxy

### 🌾 Pranata Mangsa Engine
- **12 mangsa** lengkap dengan karakteristik, penanda alam, rekomendasi tradisional
- **Crop matcher per anomaly** — rekomendasi tanaman menyesuaikan kondisi kekeringan/banjir/normal
- **Rekalibrasi otomatis** tradisional vs prediksi ML dengan deviation display
- **Transition alert** saat mangsa akan berganti dalam ≤7 hari

### 🗓️ Seasonal Intelligence
- **Forecast 1–14 hari** dengan confidence intervals
- **3 view mode:** 7 hari (harian), 30 hari (mingguan), 3 bulan (bulanan)
- **Planting window detection** — highlight periode tanam optimal
- **Full-width chart** untuk keterbacaan maksimal

### 📡 Vulnerability Mapping
- **Heatmap grid** 0.25–1° resolusi untuk risk assessment spasial
- **10 kabupaten rentan** dengan static markers (Dewanti et al., 2024)
- **Interactive popover** dengan severitas banjir/kekeringan

### 🌐 Reverse Geocoding Real-time
- **Nominatim (OpenStreetMap)** — lokasi hingga level kelurahan
- **Cache TTL 1 jam** per tile ~111m
- **Rate limit 1 req/detik** sesuai ToS Nominatim

### 🎨 User Experience
- **Compact bento grid layout** — dashboard padat, minim whitespace, optimal di desktop
- **Dark/light mode** dengan glassmorphism theme
- **Framer Motion animations** — entrance stagger, spring counter, reduced-motion aware
- **Error boundary & graceful fallback** — tanpa Gemini key pun berfungsi penuh
- **Global toast notifications** (Sonner)
- **FadeInWords** — narasi AI muncul kata per kata seperti "AI sedang menulis"

### 🔐 API & Security
- **SlowAPI rate limiting** per-IP (60/min predict, 20/min recommendation)
- **CORS policy** terkonfigurasi per environment
- **Request ID tracing** (`X-Request-ID` header)
- **Pydantic v2** validation backend, TypeScript strict frontend

---

## 🗂️ Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────────┐
│              FRONTEND (Next.js 16 App Router)                │
├──────────────────────────────────────────────────────────────┤
│  MapView (Mapbox GL) ──click──> Zustand Store ──fetch──┐     │
│  7 BentoCard Dashboard         + Reverse Geocode       │     │
│  Theme Toggle · Landing Page (static HTML)             │     │
└──────────────────────────────────────────────────────────────┘
                                                         │
                                    POST /api/recommendation
                                                         │
                                                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  BACKEND (FastAPI + Uvicorn)                 │
├──────────────────────────────────────────────────────────────┤
│  Middleware: Request ID · Rate Limiting · CORS               │
│                                                              │
│  Routers:                                                    │
│  ├─ POST /api/predict          weather + ML classification   │
│  ├─ POST /api/recommendation   hybrid: weather+mangsa+LLM   │
│  ├─ GET  /api/mangsa/*         Pranata Mangsa lookup         │
│  ├─ GET  /api/vulnerability/*  spatial heatmap grid          │
│  └─ GET  /health               status + LLM availability     │
│                                                              │
│  Services:                                                   │
│  ├─ Pranata Mangsa Engine  (12 mangsa, crop matcher)        │
│  ├─ Weather Aggregator     (Open-Meteo + fallback mock)     │
│  ├─ ML Pipeline            (RF + GB + SVM ensemble)         │
│  ├─ LLM Service            (Gemini 2.5 Flash + TTL cache)   │
│  └─ Geocode Service        (Nominatim reverse geocode)      │
└──────────────────────────────────────────────────────────────┘
           │              │                 │
           ▼              ▼                 ▼
     ┌──────────┐  ┌────────────┐  ┌──────────────────┐
     │ Open-    │  │ NASA POWER │  │ Nominatim OSM    │
     │ Meteo    │  │(solar rad) │  │(reverse geocode) │
     └──────────┘  └────────────┘  └──────────────────┘
```

---

## 🔑 Konfigurasi Environment

### Backend — `backend/.env`

Salin dari `backend/.env.example`:

| Variable | Default | Keterangan |
|---|---|---|
| `GEMINI_API_KEY` | _(kosong)_ | API key Google AI Studio — **opsional**, tanpa key fallback ke narasi statis |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model Gemini yang digunakan |
| `GEMINI_TEMPERATURE` | `0.7` | Sampling temperature LLM |
| `GEMINI_CACHE_TTL_SEC` | `300` | Cache TTL per (lat,lon,mangsa,risk) |
| `GEMINI_TIMEOUT_SEC` | `20.0` | Timeout panggilan Gemini |
| `WEATHER_PROVIDER` | `openmeteo` | `openmeteo` atau `mock` |
| `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com/v1/forecast` | URL provider cuaca |
| `OPEN_METEO_TIMEOUT_SEC` | `8.0` | Timeout HTTP ke Open-Meteo |
| `CORS_ORIGINS` | `http://localhost:3000,...` | CSV list origin yang diizinkan |
| `RATE_LIMIT_ENABLED` | `true` | Set `false` untuk test/CI |
| `RATE_LIMIT_PREDICT` | `60/minute` | per-IP untuk `/api/predict` |
| `RATE_LIMIT_RECOMMENDATION` | `20/minute` | per-IP untuk `/api/recommendation` |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `APP_ENVIRONMENT` | `development` | `development` atau `production` |

### Frontend — `frontend/.env.local`

Salin dari `frontend/.env.local.example`:

| Variable | Default | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | _(kosong)_ | **WAJIB** — public token Mapbox GL ([daftar gratis](https://account.mapbox.com/access-tokens/)) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL backend FastAPI |

---

## 📦 Stack Teknologi

| Layer | Teknologi | Versi |
|---|---|---|
| **Backend** | FastAPI + Uvicorn + Pydantic v2 | Python 3.12 |
| **ML** | scikit-learn + joblib + pandas | ≥1.5 |
| **LLM** | Google Gemini (google-generativeai) | 2.5-flash |
| **HTTP Client** | httpx (async) | ≥0.27 |
| **Frontend** | Next.js App Router + React | 16.2.4 / 19.2.5 |
| **State** | Zustand | 5.0.12 |
| **UI/Styling** | Tailwind CSS + Framer Motion + Lucide | 3.4.19 / 11.18 |
| **Maps** | Mapbox GL + react-map-gl | 3.7.0 / 7.1.7 |
| **Charts** | Recharts | 2.15.4 |
| **Toast** | Sonner | 2.0.7 |
| **HTTP Client** | Axios | 1.15.2 |
| **Validation** | TypeScript strict + Pydantic v2 | 5.9.3 |
| **Deployment** | Docker + docker-compose | 24+ |
| **Testing** | pytest + vitest | 170+ tests |

---

## 🔌 Endpoint API Utama

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/predict?days=1..14` | Cuaca + risk + anomaly untuk koordinat |
| `POST` | `/api/recommendation` | Hybrid (cuaca + mangsa + LLM) |
| `GET` | `/api/mangsa/current` | Mangsa aktif hari ini |
| `GET` | `/api/mangsa/all` | Daftar 12 mangsa lengkap |
| `GET` | `/api/mangsa/{id}` | Detail mangsa per id (1–12) |
| `GET` | `/api/mangsa/by-date?date=YYYY-MM-DD` | Mangsa pada tanggal arbitrer |
| `GET` | `/api/vulnerability/grid` | Spatial heatmap grid |
| `GET` | `/health` | Health check + status LLM |

> Validasi koordinat: **Pulau Jawa saja** (`lat ∈ [-9, -5]`, `lon ∈ [105, 115]`), selain itu → `422`.
> Contoh `curl` lengkap: [CURL_EXAMPLES.md](./CURL_EXAMPLES.md)

---

## 🌾 Pranata Mangsa — Referensi Cepat

Kalender pertanian tradisional Jawa (dikodifikasi Pakubuwana VII, 1855). 12 mangsa berbasis tahun matahari (365 hari):

| # | Nama | Periode | Musim |
|---|---|---|---|
| 1 | Kasa | 22 Jun – 1 Agt | Awal kemarau |
| 2 | Karo | 2 Agt – 24 Agt | Kemarau |
| 3 | Katiga | 25 Agt – 17 Sep | Puncak kemarau |
| 4 | Kapat | 18 Sep – 12 Okt | Pancaroba |
| 5 | Kalima | 13 Okt – 8 Nov | Awal hujan |
| 6 | Kanem | 9 Nov – 21 Des | Hujan |
| 7 | Kapitu | 22 Des – 2 Feb | Puncak hujan |
| 8 | Kawolu | 3 Feb – 28/29 Feb | Hujan menurun |
| 9 | Kasanga | 1 Mar – 25 Mar | Akhir hujan |
| 10 | Kasadasa | 26 Mar – 18 Apr | Pancaroba |
| 11 | Desta | 19 Apr – 11 Mei | Panen raya |
| 12 | Sadha | 12 Mei – 21 Jun | Akhir panen |

Sumber data: [`backend/app/data/pranata_mangsa.json`](./backend/app/data/pranata_mangsa.json)

---

## 🧪 Testing

```bash
# Backend — dari direktori backend/
pytest -q                                             # Semua 170+ tests
pytest -q tests/test_pranata_mangsa.py               # Pranata Mangsa unit tests
pytest --cov=app                                      # Coverage report

# Frontend — dari direktori frontend/
npm run test                                          # Vitest (run once)
npm run test:watch                                    # Watch mode
npm run type-check                                    # TypeScript strict check
npm run lint                                          # ESLint
npm run build                                         # Production build check
```

---

## 👥 Tim Pengembang

| Nama | Role | Expertise |
|---|---|---|
| 1. _______________ | Backend Lead / ML | Python, FastAPI, scikit-learn |
| 2. _______________ | Frontend Lead / UI | Next.js, React, Tailwind, Maps |
| 3. _______________ | Data & Integration | Weather APIs, Data validation |
| 4. _______________ | QA & DevOps | Testing, Docker, CI/CD |

---

## 📄 Lisensi

MIT License. Sumber data Pranata Mangsa berbasis dokumentasi historis publik. Kode & abstraksi disediakan apa adanya.
