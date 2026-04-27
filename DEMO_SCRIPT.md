# AGROWTH — Demo Script untuk Hackathon

> **Durasi target**: 5 menit presentasi + 3 menit Q&A juri.
> **Dokumen ini** berisi urutan demo, angka kunci, dan antisipasi pertanyaan.

---

## Urutan Demo 5 Menit

### Menit 0:00–0:30 — Hook & Problem Statement

1. Buka dashboard AGROWTH (tampilan peta Pulau Jawa + bento grid).
2. Tunjukkan **vulnerability heatmap** yang langsung terlihat — titik-titik biru (banjir) dan oranye (kekeringan) tersebar di peta.
3. Hover ke **Bojonegoro** → popup muncul: "402 ha terdampak banjir (Dewanti et al., 2024)".
4. **Narasi**: *"Bojonegoro kehilangan 402 hektar lahan pertanian karena banjir. Di sebelahnya, Lamongan kehilangan 396 hektar. Petani Jawa kehilangan tanah dan harapan — AGROWTH hadir untuk mencegah itu."*

### Menit 0:30–1:30 — Klik Peta & Lihat Pipeline Bekerja

1. Klik titik di sekitar **Yogyakarta** (-7.80, 110.37) di peta.
2. Tunjukkan toast notification "Rekomendasi siap · DI Yogyakarta".
3. Scroll ke bento grid — semua kartu terisi dalam <2 detik:
   - **Kondisi Cuaca**: 4 metrik (suhu, kelembapan, curah hujan, angin) + badge "Simulasi Demo" (hover → tooltip transparansi).
   - **Prakiraan 7 Hari**: line chart dengan highlight anomali.
   - **Pranata Mangsa**: progress bar mangsa aktif + periode.
   - **Risk Gauge**: animated SVG gauge menunjukkan level risiko.
   - **Rekomendasi AI**: narasi Bahasa Jawa krama dari Mbah Tani Digital.
4. **Narasi**: *"Satu klik — petani mendapat prediksi cuaca, kalender tradisional, dan rekomendasi AI yang berbicara dalam bahasa mereka."*

### Menit 1:30–2:30 — Pranata Mangsa + Rekomendasi AI

1. Scroll ke **Rekomendasi AI card**.
2. Tunjukkan:
   - `mangsa_greeting`: sapaan Jawa krama (italic di atas).
   - `traditional_wisdom`: blockquote kearifan lokal.
   - `narrative`: narasi 80-120 kata Bahasa Jawa — kata demi kata muncul (FadeInWords animation).
   - `traditional_proverb`: peribahasa Jawa di footer.
3. Highlight bahwa narasi menyebut **nama mangsa 2x** dan **tanda alam** spesifik.
4. **Narasi**: *"Ini bukan chatbot generik. Ini Mbah Tani Digital — sesepuh yang paham sains cuaca DAN hafal 12 Pranata Mangsa. Bicaranya hangat, dalam krama alus Jawa."*

### Menit 2:30–3:30 — Arsitektur Teknis (Slide/Diagram)

1. Tunjukkan diagram arsitektur (atau sebut secara verbal):
   - **3 sumber data terintegrasi**: BMKG klimatologis, NASA POWER (radiasi matahari), GHG regional.
   - **3 model ML ensemble**: Random Forest + Gradient Boosting + SVM — dilatih dari data gabungan ketiga sumber.
   - **Open-Meteo API** untuk cuaca real-time (sudah aktif).
   - **Gemini 2.5 Flash** untuk narasi Bahasa Jawa (dengan fallback statis).
2. Buka **`/docs`** (Swagger UI) → tunjukkan endpoint `GET /api/data-sources` → klik "Try it out" → response menampilkan seluruh registry sumber data, status integrasi, dan disclaimer.
3. **Narasi**: *"Transparan — setiap field punya sumber yang jelas, dan kami tunjukkan mana yang live, mana yang mock, dan kapan estimasi produksi."*

### Menit 3:30–4:30 — Vulnerability Map & Impact

1. Kembali ke peta. Toggle "Area Rentan" → ON.
2. Hover ke beberapa kabupaten: tunjukkan severity bar + kutipan sumber.
3. Sebut angka:
   - **402 ha** gagal panen Bojonegoro (banjir)
   - **396 ha** gagal panen Lamongan (banjir)
   - **3 kali kekeringan dalam 4 tahun** di koridor Pantura
4. **Narasi**: *"Layer ini bukan dekorasi — ini data nyata dari Dewanti et al. (2024) yang menunjukkan urgensi masalah."*

### Menit 4:30–5:00 — Closing & SDG Alignment

1. Sebut alignment SDG:
   - **SDG 2** (Zero Hunger): rekomendasi tanam adaptif berbasis cuaca + mangsa.
   - **SDG 13** (Climate Action): deteksi anomali iklim dan peringatan dini.
   - **SDG 15** (Life on Land): pemetaan kerentanan lahan pertanian.
2. **Narasi**: *"AGROWTH bukan hanya teknologi — ini jembatan antara sains modern dan kearifan leluhur Jawa, untuk petani yang paling terdampak perubahan iklim."*

---

## Angka Kunci untuk Disebutkan

| Angka | Konteks | Sumber |
|-------|---------|--------|
| **402 ha** | Lahan pertanian terdampak banjir di Bojonegoro | Dewanti et al., 2024 |
| **396 ha** | Lahan pertanian terdampak banjir di Lamongan | Dewanti et al., 2024 |
| **3× kekeringan dalam 4 tahun** | Frekuensi kekeringan di koridor Pantura Jawa | Data BMKG historis |
| **12 mangsa** | Jumlah periode dalam kalender Pranata Mangsa | Tradisi pertanian Jawa |
| **3 model ML** | Random Forest + Gradient Boosting + SVM | Arsitektur Multi-ML Ensemble |
| **3 sumber data** | BMKG + NASA POWER + GHG Regional | Pipeline data AGROWTH |
| **SDG 2, 13, 15** | Alignment dengan Sustainable Development Goals | UN SDG Framework |

---

## Pertanyaan Juri yang Diantisipasi

### Q1: "Apakah data ini real?"

**A**: Data cuaca saat ini menggunakan **simulasi deterministik** yang di-seed dari koordinat dan tanggal — ini sengaja untuk stabilitas demo hackathon. Namun, pipeline ke data real sudah **sepenuhnya disiapkan**:

- **`bmkg_service.py`** di `backend/app/services/` berisi integrasi ke BMKG Open API (`https://api.bmkg.go.id/publik/prakiraan-cuaca`) untuk suhu dan kelembapan real-time. Kami memilih mock karena rate limit API BMKG yang ketat pada saat demo berlangsung.
- **`nasa_power.py`** di `backend/app/services/` sudah terintegrasi aktif untuk estimasi radiasi matahari (parameter `ALLSKY_SFC_SW_DWN`) dari NASA POWER API — data ini sudah digunakan sebagai fitur ML.
- **`weather_openmeteo.py`** sudah aktif sebagai provider cuaca real-time dari Open-Meteo API (gratis, tanpa API key). Fallback otomatis ke mock jika offline.
- **`data_source_registry.py`** di `backend/app/services/` berisi registry lengkap setiap field cuaca beserta sumber primernya, status integrasi, dan estimasi tanggal produksi. Registry ini bisa diakses via `GET /api/data-sources`.

Dengan satu perubahan environment variable (`WEATHER_PROVIDER=openmeteo`), sistem langsung menggunakan data cuaca real.

### Q2: "Bagaimana ML model dilatih? Data training dari mana?"

**A**: Ensemble 3 model (Random Forest, Gradient Boosting, SVM) dilatih dari **gabungan 3 sumber data**:
1. **BMKG klimatologis**: baseline suhu, hujan, kelembapan historis per stasiun Pulau Jawa.
2. **NASA POWER**: estimasi radiasi matahari dan parameter energi dari satelit.
3. **GHG regional**: konteks emisi gas rumah kaca per provinsi Jawa dari data BPS.

Feature engineering menghasilkan deviasi dari baseline klimatologis (anomali suhu, anomali hujan) yang menjadi fitur utama classifier. Auto-training terjadi saat startup jika model belum ada.

### Q3: "Kenapa pakai Pranata Mangsa? Bukankah sudah ada kalender Masehi?"

**A**: Pranata Mangsa adalah **sistem observasi alam selama ratusan tahun** yang mengkodifikasi tanda-tanda alam (gugurnya daun jati, munculnya laron, bunyi gareng pung) sebagai sinyal perubahan musim. Sistem ini:
- Bersifat **hyperlocal** untuk Pulau Jawa — lebih akurat dari kalender Masehi untuk konteks pertanian Jawa.
- Memberikan **bahasa dan framing** yang dipahami petani tradisional — narasi "mangsa Kasa" lebih bermakna daripada "Juni-Juli".
- **Komplementer** dengan data cuaca modern — AGROWTH menggabungkan keduanya, bukan menggantikan.

### Q4: "Bagaimana scalability ke luar Pulau Jawa?"

**A**: Arsitektur AGROWTH dirancang modular:
- **Koordinat validator** di `CoordinateInput` bisa diperluas batasnya.
- **Pranata Mangsa** spesifik Jawa, tapi framework `pranata_mangsa.py` bisa di-extend dengan kalender pertanian tradisional daerah lain (misalnya Subak di Bali, Wariga di NTT).
- **ML pipeline** hanya perlu data klimatologis baru per region — arsitektur feature engineering sudah generik.
- **Open-Meteo API** coverage global — tidak terbatas Jawa.

### Q5: "Apa rencana ke depan / roadmap?"

**A**:
- **Q3 2025**: Aktivasi penuh BMKG Open API dan NASA POWER API untuk data real-time (pipeline sudah siap di `bmkg_service.py` dan `nasa_power.py`).
- **Q4 2025**: Integrasi data emisi GHG real-time dari BPS API (saat ini masih statis per provinsi).
- **2026**: Ekspansi ke provinsi luar Jawa, dimulai dari Bali dan Sumatera, dengan kalender pertanian tradisional lokal.
- **Ongoing**: Penambahan model ML untuk prediksi harga komoditas pertanian berdasarkan pola cuaca dan musim tanam.

---

## Checklist Sebelum Demo

- [ ] Backend berjalan (`uvicorn main:app --reload` di `backend/`)
- [ ] Frontend berjalan (`npm run dev` di `frontend/`)
- [ ] Mapbox token sudah di-set di `frontend/.env.local`
- [ ] Browser zoom 100%, dark mode aktif
- [ ] Swagger UI (`/docs`) bisa diakses untuk demo transparansi
- [ ] Vulnerability layer ON secara default (toggle hijau terlihat)
- [ ] Siapkan koordinat Yogyakarta (-7.80, 110.37) untuk klik pertama
