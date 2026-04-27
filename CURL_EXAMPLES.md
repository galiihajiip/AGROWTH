# AGROWTH API — Contoh `curl`

Daftar contoh `curl` siap copy-paste untuk semua endpoint utama.

## Menjalankan server lokal

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Base URL: `http://localhost:8000`
Dokumentasi interaktif: `http://localhost:8000/docs`

> Catatan: contoh berikut memakai sintaks bash (single-quote inline JSON).
> Pada Windows `cmd.exe` ganti dengan double-quote yang ter-escape, atau pakai
> Git Bash / PowerShell.

---

## 1) Health check

```bash
curl http://localhost:8000/health
```

**Expected output:**

```json
{"status": "healthy"}
```

---

## 2) `POST /api/predict` — Prediksi cuaca + risiko + anomali

Koordinat **harus** di dalam Pulau Jawa: `lat ∈ [-9, -5]`, `lon ∈ [105, 115]`.
Di luar batas → **422 Unprocessable Entity**.

Optional query param `days` (1..14, default 7) mengatur panjang forecast.

### Contoh sukses (Yogyakarta, 7 hari)

```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"lat": -7.7956, "lon": 110.3695}'
```

### Forecast 14 hari

```bash
curl -X POST 'http://localhost:8000/api/predict?days=14' \
  -H "Content-Type: application/json" \
  -d '{"lat": -7.7956, "lon": 110.3695}'
```

**Expected output (sample, deterministik per tanggal & koordinat):**

```json
{
  "location": {
    "lat": -7.79,
    "lon": 110.37,
    "name": "Lokasi DI Yogyakarta",
    "province": "DI Yogyakarta",
    "region": null,
    "elevation_m": null
  },
  "current": {
    "timestamp": "2025-04-27T12:00:00",
    "temperature_c": 27.4,
    "humidity_pct": 82.1,
    "rainfall_mm": 0.0,
    "wind_speed_ms": 2.31,
    "pressure_hpa": 1010.2,
    "condition": "cerah berawan"
  },
  "forecast": [
    {
      "date": "2025-04-28",
      "temp_min_c": 23.4,
      "temp_max_c": 30.1,
      "humidity_pct": 80.5,
      "rainfall_mm": 1.2,
      "wind_speed_ms": 2.0,
      "condition": "cerah berawan"
    }
    /* ... 6 entri lainnya (default days=7) ... */
  ],
  "risk_level": "low",
  "anomaly": "normal"
}
```

### Contoh gagal (di luar Pulau Jawa → 422)

```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"lat": -3.5, "lon": 110.0}'
```

**Expected output (HTTP 422):**

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "lat"],
      "msg": "Value error, Latitude di luar batas Pulau Jawa (harus antara -9 dan -5)",
      "input": -3.5,
      "ctx": {"error": {}}
    }
  ]
}
```

---

## 3) `POST /api/recommendation` — Rekomendasi hybrid (Mangsa + LLM + crops)

```bash
curl -X POST http://localhost:8000/api/recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": {"lat": -7.7956, "lon": 110.3695},
    "crop_type": "padi"
  }'
```

**Expected output (sample, fallback statis tanpa `GEMINI_API_KEY`):**

```json
{
  "location": { "lat": -7.79, "lon": 110.37, "province": "DI Yogyakarta", "name": "Lokasi DI Yogyakarta" },
  "current": { "temperature_c": 27.4, "humidity_pct": 82.1, "condition": "cerah berawan" /* ... */ },
  "forecast": [ /* 7 entri */ ],
  "mangsa": {
    "number": 11,
    "name": "Desta",
    "period_start": "04-19",
    "period_end": "05-11",
    "duration_days": 23,
    "season": "pancaroba",
    "description": "Mangsa panen raya padi sawah. ...",
    "characteristics": [ /* ... */ ],
    "recommended_activities": [ /* ... */ ],
    "avoid_activities": []
  },
  "risk_level": "low",
  "anomaly": "normal",
  "recommendations": [
    "Saatnya panen padi raya",
    "Hasil panen harus segera dijemur dengan baik agar tidak rusak",
    "Gabah disimpan di lumbung yang kering dan bersih untuk menghindari hama gudang",
    "Sebagian hasil dapat dijadikan benih untuk musim tanam berikutnya",
    "Lakukan upacara wiwit atau syukuran panen sesuai tradisi",
    "Pilihan tanaman direkomendasikan: padi panen raya, persiapan benih"
  ],
  "weather_advice": "Mangsa Desta (04-19–05-11) nelakaké musim pancaroba: ...",
  "risk_warnings": [
    "Risiko cuaca rendah; lanjutkan pemantauan harian sawah dan kebun."
  ],
  "summary": "Kulo aturaken, sedulur tani, ing mangsa Desta menika bumi nembe mlebet musim pancaroba. ...",
  "mangsa_greeting": "Kulo nuwun, sedulur tani ing mangsa Desta menika, mugi tansah pinaringan wilujeng lan berkah.",
  "traditional_proverb": "Sapa nandur bakal ngundhuh; alam kang tentrem iku kanca sejatining tani.",
  "generated_at": "2025-04-27T09:45:12.345678"
}
```

> Set environment variable `GEMINI_API_KEY=...` (atau di file `.env`) untuk
> mengaktifkan rekomendasi LLM Gemini 2.5 Flash. Tanpa key, sistem otomatis
> memakai fallback statis berbasis Pranata Mangsa.

---

## 4) `GET /api/mangsa/current` — Mangsa aktif hari ini

```bash
curl http://localhost:8000/api/mangsa/current
```

**Expected output (sample, tergantung tanggal saat dipanggil):**

```json
{
  "number": 11,
  "name": "Desta",
  "period_start": "04-19",
  "period_end": "05-11",
  "duration_days": 23,
  "season": "pancaroba",
  "description": "Mangsa panen raya padi sawah. Petani sibuk memanen, menjemur, dan menyimpan gabah. ...",
  "characteristics": [
    "Padi siap panen, sawah-sawah menguning serentak",
    "Burung-burung memberi makan dan mengasuh anaknya di sarang",
    "Pohon mangga mulai berbuah",
    "Pohon manggis berbuah lebat",
    "Cuaca cerah berturut-turut, sangat baik untuk menjemur",
    "Air sungai mulai surut, debit menurun"
  ],
  "recommended_activities": [
    "Saatnya panen padi raya",
    "Hasil panen harus segera dijemur dengan baik agar tidak rusak",
    "Gabah disimpan di lumbung yang kering dan bersih untuk menghindari hama gudang",
    "Sebagian hasil dapat dijadikan benih untuk musim tanam berikutnya",
    "Lakukan upacara wiwit atau syukuran panen sesuai tradisi"
  ],
  "avoid_activities": []
}
```

---

## 5) `GET /api/mangsa/{id}` — Detail mangsa berdasarkan id

### Sukses (Kapitu, id = 7)

```bash
curl http://localhost:8000/api/mangsa/7
```

**Expected output:**

```json
{
  "number": 7,
  "name": "Kapitu",
  "period_start": "12-22",
  "period_end": "02-02",
  "duration_days": 43,
  "season": "hujan",
  "description": "Mangsa rawan bencana hidrometeorologi. Banjir, tanah longsor, dan angin puting beliung sering terjadi. ...",
  "characteristics": [
    "Hujan deras berlangsung berhari-hari tanpa jeda",
    "Sungai-sungai meluap, banyak banjir di dataran rendah",
    "Banyak nyamuk berkembang biak di genangan air",
    "Burung-burung migrasi singgah di sawah dan rawa",
    "Padi yang ditanam mulai meninggi dan menghijau lebat",
    "Petir dan halilintar sering disertai angin kencang"
  ],
  "recommended_activities": [
    "Waspada terhadap banjir dan longsor",
    "Tanggul dan pematang sawah harus terus dijaga dan diperkuat",
    "Perawatan padi dilakukan intensif termasuk penyiangan dan pemupukan",
    "Kesehatan keluarga harus dijaga dengan menjaga kebersihan air dan lingkungan, serta menutup penampungan air agar nyamuk tidak berkembang"
  ],
  "avoid_activities": []
}
```

### Tidak ditemukan (id di luar 1..12 → 404)

```bash
curl -i http://localhost:8000/api/mangsa/13
```

**Expected output (HTTP 404):**

```json
{"detail": "Mangsa id=13 tidak ditemukan"}
```

---

## Bonus: list semua mangsa

```bash
curl http://localhost:8000/api/mangsa/all | jq '.[] | {number, name, period_start, period_end}'
```

**Expected output (12 entri):**

```json
{ "number": 1,  "name": "Kasa",     "period_start": "06-22", "period_end": "08-01" }
{ "number": 2,  "name": "Karo",     "period_start": "08-02", "period_end": "08-24" }
{ "number": 3,  "name": "Katiga",   "period_start": "08-25", "period_end": "09-17" }
{ "number": 4,  "name": "Kapat",    "period_start": "09-18", "period_end": "10-12" }
{ "number": 5,  "name": "Kalima",   "period_start": "10-13", "period_end": "11-08" }
{ "number": 6,  "name": "Kanem",    "period_start": "11-09", "period_end": "12-21" }
{ "number": 7,  "name": "Kapitu",   "period_start": "12-22", "period_end": "02-02" }
{ "number": 8,  "name": "Kawolu",   "period_start": "02-03", "period_end": "02-28" }
{ "number": 9,  "name": "Kasanga",  "period_start": "03-01", "period_end": "03-25" }
{ "number": 10, "name": "Kasadasa", "period_start": "03-26", "period_end": "04-18" }
{ "number": 11, "name": "Desta",    "period_start": "04-19", "period_end": "05-11" }
{ "number": 12, "name": "Sadha",    "period_start": "05-12", "period_end": "06-21" }
```

---

## Menjalankan tes pytest

```bash
cd backend
pytest tests/ -v
```

**Expected output (6 tes lulus):**

```
tests/test_endpoints.py::test_health_check PASSED
tests/test_endpoints.py::test_predict_valid_yogyakarta PASSED
tests/test_endpoints.py::test_predict_outside_java_returns_422 PASSED
tests/test_endpoints.py::test_get_current_mangsa PASSED
tests/test_endpoints.py::test_mangsa_by_id_valid PASSED
tests/test_endpoints.py::test_mangsa_by_id_invalid_returns_404 PASSED

============================== 6 passed in 0.xx s ==============================
```
