/**
 * AGROWTH Landing Page — Animated Counter
 *
 * Animates numeric values from 0 (or a start value) to a target number
 * once the element enters the viewport.
 *
 * Usage in HTML:
 *   <span
 *     data-counter
 *     data-target="85000"
 *     data-duration="1800"
 *     data-compact="true"
 *     data-decimals="0"
 *     data-suffix="%"
 *   >0</span>
 *
 * Attributes:
 *   data-target    — final value (required)
 *   data-duration  — animation duration in ms (default 1500)
 *   data-compact   — "true" to use K/M suffix (default false)
 *   data-decimals  — decimal places (default 0)
 *   data-prefix    — text prepended to number (e.g. "Rp")
 *   data-suffix    — text appended to number  (e.g. "%")
 */

'use strict';

/* ============================================================
   Easing
   ============================================================ */

/** Ease-out cubic — fast start, slow finish */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* ============================================================
   Animate a single counter element
   ============================================================ */

function animateCounter(el) {
  const target   = parseFloat(el.dataset.target)   || 0;
  const duration = parseInt(el.dataset.duration, 10) || 1500;
  const compact  = el.dataset.compact === 'true';
  const decimals = parseInt(el.dataset.decimals, 10) || 0;
  const prefix   = el.dataset.prefix || '';
  const suffix   = el.dataset.suffix || '';

  const format = window.AGROWTH?.formatNumber ?? ((n) => n.toFixed(decimals));

  const start = performance.now();

  function tick(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOutCubic(progress);
    const current  = target * eased;

    el.textContent = prefix + format(current, { compact, decimals }) + suffix;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Ensure exact final value
      el.textContent = prefix + format(target, { compact, decimals }) + suffix;
      el.dispatchEvent(new CustomEvent('counter:done', { bubbles: true }));
    }
  }

  requestAnimationFrame(tick);
}

/* ============================================================
   Observe all counters
   ============================================================ */

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target); // animate once
        }
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach((el) => observer.observe(el));
}

/* ============================================================
   Stat Cards — reveal on viewport entry
   ============================================================ */

function initStatCards() {
  const cards = document.querySelectorAll('.stat-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          entry.target.style.transform = 'translateY(0)';
          entry.target.style.opacity = '1';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  cards.forEach((card) => {
    card.style.transform = 'translateY(20px)';
    observer.observe(card);
  });
}

/* ============================================================
   Init
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initCounters();
  initStatCards();
});

/* ============================================================
   Exports
   ============================================================ */
window.AGROWTH = window.AGROWTH || {};
Object.assign(window.AGROWTH, { animateCounter, initCounters });
