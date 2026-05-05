/**
 * AGROWTH Landing Page — Section-Specific Animations
 *
 * This module handles orchestrated, section-level animations:
 * - Hero entrance sequence
 * - Ticker / marquee initialization
 * - Grain overlay animation
 * - Parallax helpers
 *
 * Runs after DOMContentLoaded (loaded after main.js).
 */

'use strict';

/* ============================================================
   Nav — scroll toggle + scroll spy + hamburger
   ============================================================ */

function initNavScroll() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
    const indicator = document.getElementById('scroll-indicator');
    if (indicator) indicator.classList.toggle('hidden', window.scrollY > 100);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initScrollSpy() {
  const spySections = ['features', 'how-it-works', 'demo', 'impact'];
  const navLinks = document.querySelectorAll('.nav-link[data-section]');
  if (!navLinks.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.dataset.section === id);
          });
        }
      });
    },
    { threshold: 0.4, rootMargin: '-10% 0px -55% 0px' }
  );

  spySections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

function initHamburger() {
  const nav    = document.getElementById('main-nav');
  const toggle = document.getElementById('menu-toggle');
  const mobile = document.getElementById('nav-mobile');
  if (!nav || !toggle || !mobile) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    mobile.setAttribute('aria-hidden', String(!isOpen));
  });

  mobile.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      mobile.setAttribute('aria-hidden', 'true');
    });
  });
}

/* ============================================================
   Hero Entrance Sequence
   ============================================================ */

/**
 * Stagger-animate hero children using CSS delay utilities.
 * Elements inside #hero that carry [data-hero-item] receive their
 * animate class in order, creating a cascading entrance.
 */
function initHeroEntrance() {
  const items = document.querySelectorAll('[data-hero-item]');
  items.forEach((el, i) => {
    const delay = (i + 1) * 100; // 100ms, 200ms, …
    el.style.animationDelay = `${delay}ms`;
    el.classList.add('animate-fade-in-up');
  });
}

/* ============================================================
   Ticker / Marquee
   ============================================================ */

/**
 * Duplicate ticker content so the CSS infinite scroll loops seamlessly.
 * Expects: .ticker-wrapper > .ticker-track > [items]
 */
function initTicker() {
  const track = document.querySelector('.ticker-track');
  if (!track) return;

  // Clone children to create seamless loop (CSS translateX(-50%) trick)
  const clone = track.cloneNode(true);
  track.parentElement.appendChild(clone);

  track.classList.add('animate-ticker');
}

/* ============================================================
   Grain Overlay
   ============================================================ */

function initGrainOverlay() {
  const overlay = document.querySelector('.grain-overlay');
  if (!overlay) return;
  overlay.classList.add('animate-grain');
}

/* ============================================================
   Parallax — subtle depth on scroll
   ============================================================ */

/**
 * Lightweight parallax for elements with [data-parallax="speed"].
 * `speed` is a float: positive = slower, negative = faster than scroll.
 *
 * Example: <div data-parallax="0.4"> moves at 40% of scroll speed.
 */
function initParallax() {
  const elements = document.querySelectorAll('[data-parallax]');
  if (!elements.length) return;

  const onScroll = () => {
    const scrollY = window.scrollY;
    elements.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      el.style.transform = `translateY(${scrollY * speed}px)`;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ============================================================
   Pipeline boxes (Step 2) — stagger on viewport entry
   ============================================================ */

function initPipelineBoxes() {
  const steps = document.querySelectorAll('.hiw-step');
  if (!steps.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.hiw-pipe-box--anim').forEach((box) => {
            box.classList.add('visible');
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  steps.forEach((el) => observer.observe(el));
}

/* ============================================================
   Architecture pills — stagger fade-in on viewport entry
   ============================================================ */

function initArchPills() {
  const bar = document.querySelector('.arch-bar');
  if (!bar) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.arch-pill').forEach((pill) => {
            pill.classList.add('visible');
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  observer.observe(bar);
}

/* ============================================================
   Gap Diagram — animate bars on viewport entry
   ============================================================ */

function initGapBars() {
  const diagrams = document.querySelectorAll('.gap-diagram');
  if (!diagrams.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.gap-bar').forEach((bar) => {
            bar.classList.add('animated');
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  diagrams.forEach((el) => observer.observe(el));
}

/* ============================================================
   Init
   ============================================================ */

function initAnimations() {
  initNavScroll();
  initScrollSpy();
  initHamburger();
  initHeroEntrance();
  initTicker();
  initGrainOverlay();
  initParallax();
  initGapBars();
  initPipelineBoxes();
  initArchPills();
}

document.addEventListener('DOMContentLoaded', initAnimations);

/* ============================================================
   Exports
   ============================================================ */
window.AGROWTH = window.AGROWTH || {};
Object.assign(window.AGROWTH, { initNavScroll, initScrollSpy, initHamburger, initHeroEntrance, initTicker, initParallax });
