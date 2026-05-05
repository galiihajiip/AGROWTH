/**
 * AGROWTH Landing Page — Main Script
 * Utility functions, Intersection Observer, smooth scroll, mobile menu.
 */

'use strict';

/* ============================================================
   Intersection Observer — reveal animations on scroll
   ============================================================ */

/**
 * Attach an Intersection Observer that adds `animationClass` to elements
 * matching `selector` once they enter the viewport.
 *
 * @param {string} selector       - CSS selector for target elements
 * @param {string} animationClass - Class to add when element is visible
 * @param {number} [threshold=0.15] - Ratio of element visibility required
 */
function observeElements(selector, animationClass, threshold = 0.15) {
  const elements = document.querySelectorAll(selector);
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(animationClass);
          observer.unobserve(entry.target); // fire once
        }
      });
    },
    { threshold }
  );

  elements.forEach((el) => observer.observe(el));
}

/* ============================================================
   Smooth Scroll — anchor links
   ============================================================ */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ============================================================
   Mockup Card Stagger
   ============================================================ */

function initMockupCards() {
  const cards = document.querySelectorAll('.mockup-card');
  if (!cards.length) return;

  cards.forEach((card, i) => {
    setTimeout(() => {
      card.classList.add('visible');
    }, 600 + i * 200);
  });
}

/* ============================================================
   Demo — city preset data + switcher + typewriter
   ============================================================ */

const CITY_PRESETS = {
  Yogyakarta: {
    lat: '-7.7956', lon: '110.3695',
    risk_level: 'MEDIUM', risk_class: 'demo-card-value--medium',
    anomaly_score: '0.52',
    mangsa_name: 'Kanem', mangsa_period: '9 Nov – 21 Des',
    rainfall: [40, 55, 62, 48, 70, 65, 58],
    recommendation_preview: '"Kulo nuwun, sedulur tani… Mangsa Kanem sampun dumugi. Wonten anomali curah hujan +18% saking ekspektasi. Disaranaken tunda tandur 10-14 dinten."',
    drought_prob: 0.28,
  },
  Surabaya: {
    lat: '-7.2504', lon: '112.7688',
    risk_level: 'HIGH', risk_class: 'demo-card-value--high',
    anomaly_score: '0.81',
    mangsa_name: 'Kapitu', mangsa_period: '22 Des – 2 Feb',
    rainfall: [15, 22, 18, 10, 28, 12, 20],
    recommendation_preview: '"Matur nuwun, sedulur tani… Risiko kekeringan inggil sanget. Mangsa Kapitu ngindikasikaken defisit curah hujan. Irigasi tambahan kedah dipun aktifaken."',
    drought_prob: 0.76,
  },
  Bandung: {
    lat: '-6.9175', lon: '107.6191',
    risk_level: 'LOW', risk_class: 'demo-card-value--low',
    anomaly_score: '0.21',
    mangsa_name: 'Karo', mangsa_period: '25 Ags – 17 Sep',
    rainfall: [72, 80, 91, 88, 76, 95, 83],
    recommendation_preview: '"Sugeng rawuh, sedulur tani… Kondisi mangsa Karo wonten ing Bandung diprediksi normal-optimal. Cocok kangge persiapan tanam padi varietas unggulan."',
    drought_prob: 0.08,
  },
  Semarang: {
    lat: '-6.9932', lon: '110.4203',
    risk_level: 'MEDIUM', risk_class: 'demo-card-value--medium',
    anomaly_score: '0.44',
    mangsa_name: 'Kasongo', mangsa_period: '2 Feb – 28 Feb',
    rainfall: [35, 42, 50, 38, 55, 48, 44],
    recommendation_preview: '"Kulo nuwun, sedulur tani… Anomali suhu +1.2°C terdeteksi. Mangsa Kasongo ing Semarang menunjukaken potensi banjir lokal 32%. Awas sawah rawan genangan."',
    drought_prob: 0.31,
  },
  Malang: {
    lat: '-7.9666', lon: '112.6326',
    risk_level: 'LOW', risk_class: 'demo-card-value--low',
    anomaly_score: '0.18',
    mangsa_name: 'Kapat', mangsa_period: '19 Sep – 13 Okt',
    rainfall: [68, 74, 82, 79, 71, 88, 77],
    recommendation_preview: '"Sugeng rawuh, sedulur tani Malang… Mangsa Kapat kondisi apik. Data BMKG lan NASA POWER selaras — prediksi panen optimal. Manfaataken momentum niki."',
    drought_prob: 0.11,
  },
  Bojonegoro: {
    lat: '-7.1543', lon: '111.8815',
    risk_level: 'HIGH', risk_class: 'demo-card-value--high',
    anomaly_score: '0.87',
    mangsa_name: 'Kanem', mangsa_period: '9 Nov – 21 Des',
    rainfall: [8, 12, 6, 14, 10, 7, 11],
    recommendation_preview: '"Kulo nuwun, sedulur tani Bojonegoro… Wilayah panjenengan tercatat riwayat banjir 402 ha. Anomali El Niño aktif. SANGAT disaranaken tunda tanam minimal 3 minggu."',
    drought_prob: 0.82,
  },
  Lamongan: {
    lat: '-7.1193', lon: '112.4151',
    risk_level: 'HIGH', risk_class: 'demo-card-value--high',
    anomaly_score: '0.79',
    mangsa_name: 'Kanem', mangsa_period: '9 Nov – 21 Des',
    rainfall: [10, 8, 14, 9, 16, 11, 13],
    recommendation_preview: '"Matur nuwun, sedulur tani Lamongan… Catatan gagal panen 396 ha tahun lalu. Pola anomali serupa terdeteksi. Disaranaken konsultasi PPL sebelum tanam musim ini."',
    drought_prob: 0.74,
  },
  Solo: {
    lat: '-7.5755', lon: '110.8243',
    risk_level: 'MEDIUM', risk_class: 'demo-card-value--medium',
    anomaly_score: '0.47',
    mangsa_name: 'Kawolu', mangsa_period: '26 Mar – 18 Apr',
    rainfall: [44, 52, 48, 60, 55, 49, 58],
    recommendation_preview: '"Kulo nuwun, sedulur tani Solo… Mangsa Kawolu diprediksi normal. Namun anomali suhu +0.8°C perlu diwaspadai. Pilih varietas toleran suhu untuk hasil optimal."',
    drought_prob: 0.35,
  },
};

let _typewriterTimer = null;

function typewriterEffect(el, text, speed = 22) {
  if (_typewriterTimer) clearInterval(_typewriterTimer);
  el.textContent = '';
  let i = 0;
  _typewriterTimer = setInterval(() => {
    el.textContent += text[i] || '';
    i++;
    if (i >= text.length) clearInterval(_typewriterTimer);
  }, speed);
}

function renderRainBars(container, values) {
  const max = Math.max(...values);
  container.innerHTML = values.map((v) => {
    const pct = Math.round((v / max) * 100);
    const hue = pct > 60 ? 'var(--color-rice-500)' : pct > 30 ? 'var(--color-amber-500)' : '#f87171';
    return `<div class="demo-rain-bar" style="height:${pct}%;background:${hue};"></div>`;
  }).join('');
}

function updateDemoPanel(cityName) {
  const data = CITY_PRESETS[cityName];
  if (!data) return;

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setText('demo-city-label', cityName);
  setText('demo-coords', `${data.lat}° S, ${data.lon}° E`);

  const riskEl = document.getElementById('demo-risk');
  if (riskEl) {
    riskEl.textContent = data.risk_level;
    riskEl.className = `demo-card-value ${data.risk_class}`;
  }

  setText('demo-anomaly', data.anomaly_score);
  setText('demo-mangsa', data.mangsa_name);
  setText('demo-mangsa-period', data.mangsa_period);

  const rainContainer = document.getElementById('demo-rain-bars');
  if (rainContainer) renderRainBars(rainContainer, data.rainfall);

  const recEl = document.getElementById('demo-recommendation');
  if (recEl) typewriterEffect(recEl, data.recommendation_preview);
}

function initDemoSwitcher() {
  const buttons = document.querySelectorAll('.demo-preset-btn');
  if (!buttons.length) return;

  updateDemoPanel('Yogyakarta');
  renderRainBars(document.getElementById('demo-rain-bars'), CITY_PRESETS.Yogyakarta.rainfall);

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('demo-preset-btn--active'));
      btn.classList.add('demo-preset-btn--active');
      updateDemoPanel(btn.dataset.city);
    });
  });
}

/* ============================================================
   Number Formatter — used by counter animation
   ============================================================ */

/**
 * Format a number for display in counter animations.
 * Supports K / M suffixes and locale-aware separators.
 *
 * @param {number} n          - Raw numeric value
 * @param {Object} [opts]     - Options
 * @param {boolean} [opts.compact=false]  - Use K/M suffix
 * @param {number}  [opts.decimals=0]     - Decimal places
 * @param {string}  [opts.locale='id-ID'] - BCP 47 locale tag
 * @returns {string}
 */
function formatNumber(n, { compact = false, decimals = 0, locale = 'id-ID' } = {}) {
  if (compact) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(decimals) + 'K';
  }
  return n.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* ============================================================
   Init
   ============================================================ */

function init() {
  observeElements('[data-animate]', 'animate-fade-in-up');
  observeElements('[data-animate-left]', 'animate-fade-in-left');
  initSmoothScroll();
  initMockupCards();
  initDemoSwitcher();
}

document.addEventListener('DOMContentLoaded', init);

/* ============================================================
   Exports (for other modules)
   ============================================================ */
window.AGROWTH = window.AGROWTH || {};
Object.assign(window.AGROWTH, { observeElements, formatNumber });
