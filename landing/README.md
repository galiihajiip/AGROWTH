# AGROWTH — Landing Page

> Sistem Intelijen Iklim Adaptif Berbasis Pranata Mangsa

Landing page yang berdiri sendiri (pure HTML/CSS/JS — tanpa framework), terpisah dari dashboard React di `/frontend`.

---

## Struktur Folder

```
landing/
├── index.html              # Skeleton HTML + meta tags + 8 section placeholders
├── styles/
│   ├── main.css            # Design tokens (CSS custom properties) + base styles + reset
│   ├── animations.css      # Keyframes + utility animation classes
│   └── components.css      # Komponen reusable: button, badge, card-glass, typography
├── scripts/
│   ├── main.js             # Intersection Observer, smooth scroll, nav, mobile menu, formatNumber
│   ├── animations.js       # Hero entrance, ticker, grain overlay, parallax
│   └── counter.js          # Animated number counter (data-counter attribute API)
├── assets/
│   ├── icons/              # SVG inline icons (tambahkan file .svg sesuai kebutuhan)
│   └── og-image-placeholder.txt  # Brief desain untuk OG image 1200×630
└── README.md               # Dokumen ini
```

---

## Cara Menjalankan (Development)

Tidak memerlukan build tool. Cukup buka langsung di browser:

```bash
# Dari root repo
cd landing
npx serve .          # atau python -m http.server 3001
```

Atau buka `landing/index.html` langsung di browser (file://).

> Catatan: Beberapa fitur (fetch, module imports) memerlukan server HTTP lokal.

---

## Design Tokens

Seluruh token warna, tipografi, dan spasi didefinisikan sebagai CSS custom properties di `styles/main.css`.

| Token                  | Nilai                          |
|------------------------|-------------------------------|
| `--bg-dark`            | `#020b04`                     |
| `--color-rice-400`     | `#4ade80`                     |
| `--color-rice-600`     | `#16a34a`                     |
| `--text-primary`       | `#f0fdf4`                     |
| `--text-secondary`     | `#86efac`                     |
| `--font-sans`          | Inter, system-ui              |
| `--font-serif`         | Playfair Display, Georgia     |
| `--font-mono`          | JetBrains Mono, Fira Code     |
| `--radius-card`        | `16px`                        |
| `--radius-pill`        | `999px`                       |

---

## Komponen CSS

### Buttons
```html
<button class="btn-primary">Coba Sekarang</button>
<button class="btn-secondary">Pelajari Lebih</button>
<button class="btn-ghost">Masuk</button>
```

### Badge
```html
<span class="badge badge-green">● Live</span>
<span class="badge badge-amber">Musim Hujan</span>
```

### Glass Card
```html
<div class="card-glass" style="padding:24px;">
  Konten kartu
</div>
```

### Typography
```html
<p class="section-label">Tentang Kami</p>
<h1 class="heading-xl text-gradient">AGROWTH</h1>
<h2 class="heading-lg">Judul Section</h2>
<h3 class="heading-md">Sub-judul</h3>
```

---

## Animasi

### CSS Utilities
Tambahkan class langsung ke elemen:
```html
<div class="animate-fade-in-up delay-200">Konten</div>
<div class="animate-float">Ikon mengambang</div>
<div class="animate-pulse-glow">Tombol highlight</div>
```

### Intersection Observer (scroll-triggered)
Tag elemen dengan `data-animate` atau `data-animate-left`:
```html
<div data-animate class="will-animate">Muncul saat di-scroll</div>
```
`main.js` akan otomatis menambahkan class animasi saat elemen masuk viewport.

### Counter
```html
<span
  data-counter
  data-target="85000"
  data-duration="1800"
  data-compact="true"
  data-suffix=" petani"
>0</span>
```

---

## Sections (Planned)

| ID               | Konten                                                   | Status     |
|------------------|----------------------------------------------------------|------------|
| `#hero`          | Headline, sub-copy, CTA, hero visual                     | Placeholder |
| `#problem`       | 3 pain points petani Jawa saat ini                       | Placeholder |
| `#solution`      | Pranata Mangsa meets ML — pendekatan AGROWTH             | Placeholder |
| `#features`      | 6 fitur utama (cards)                                    | Placeholder |
| `#how-it-works`  | Flow 3-langkah: Input → Analisis → Rekomendasi           | Placeholder |
| `#demo`          | Embed / screenshot dashboard interaktif                  | Placeholder |
| `#impact`        | Statistik dampak (animated counters)                     | Placeholder |
| `#cta`           | Final call-to-action + link dashboard                    | Placeholder |

---

## Checklist Sebelum Launch

- [ ] Ganti `og-image-placeholder.txt` dengan `og-image.png` (1200×630)
- [ ] Isi semua 8 section placeholder
- [ ] Test di mobile (375px, 390px, 430px)
- [ ] Test di Safari (webkit prefix backdrop-filter)
- [ ] Lighthouse score ≥ 90 (Performance, Accessibility, SEO)
- [ ] Set `og:url` dan `og:site_name` ke domain final
- [ ] Ganti favicon emoji dengan SVG/PNG branding resmi

---

## Target Audiens

- **Juri IYREF 2026 ITB** — kesan pertama 3 detik, tunjukkan inovasi + dampak sosial
- **Investor** — traction numbers, scalability, market size (petani Jawa >14 juta)
- **Penyuluh Pertanian** — kemudahan penggunaan, relevansi lokal, bahasa Indonesia
