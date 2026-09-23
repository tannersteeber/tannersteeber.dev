/* ------------------ main.js — Client behaviors & enhancements ------------------
  - data-year injection
  - theme system (persisted & respects prefers-color-scheme)
  - overlay navigation (clone + open/close)
  - header scrolled state via requestAnimationFrame
------------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  /* ------------------ Small DOM helpers ------------------ */
  const qs = (s, ctx = document) => ctx.querySelector(s);
  const qsa = (s, ctx = document) => Array.from((ctx || document).querySelectorAll(s));

  /* ------------------ Year injection ------------------ */
  const YEAR = new Date().getFullYear();
  qsa('[data-year]').forEach(el => el.textContent = YEAR);

  /* ------------------ Theme system ------------------ */
  const root = document.documentElement;
  const THEME_KEY = 'site-theme';
  const toggles = qsa('.theme-toggle');

  function applyTheme(theme) {
    const dark = theme === 'dark';
    root.classList.toggle('theme-dark', dark);
    toggles.forEach(btn => btn.setAttribute('aria-pressed', dark ? 'true' : 'false'));
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  function initTheme() {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (stored) { applyTheme(stored); return; }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  // wire toggle buttons
  toggles.forEach(btn => btn.addEventListener('click', () => {
    const nowDark = root.classList.contains('theme-dark');
    applyTheme(nowDark ? 'light' : 'dark');
  }));

  initTheme();

  /* ------------------ Overlay navigation ------------------ */
  const overlay = qs('.nav-overlay');
  const overlayNav = qs('.overlay-nav');
  const headerNav = qs('.nav');
  const overlayClose = qs('.overlay-close');

  function syncNav() {
    if (!overlayNav || !headerNav) return;
    overlayNav.innerHTML = headerNav.innerHTML;
    // mark active links inside overlay
    qsa('a', overlayNav).forEach(a => {
      try {
        if (location.pathname === new URL(a.href, location.origin).pathname) a.classList.add('active');
      } catch (e) { /* ignore invalid URLs */ }
    });
  }

  function openNav() {
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }

  function closeNav() {
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  syncNav();
  qsa('.nav-toggle').forEach(b => b.addEventListener('click', openNav));
  overlayClose && overlayClose.addEventListener('click', closeNav);

  // Close overlay when clicking outside overlayNav
  overlay && overlay.addEventListener('click', (e) => {
    if (!overlayNav) return;
    if (!overlayNav.contains(e.target)) closeNav();
    const a = e.target.closest && e.target.closest('a');
    if (a && overlayNav.contains(a)) closeNav();
  });

  // Extra global click close (captures)
  document.addEventListener('click', (e) => {
    if (!overlay || !overlay.classList.contains('open')) return;
    const target = e.target;
    if (!overlayNav) return closeNav();
    if (overlayNav.contains(target) || target.closest('.nav-toggle')) return;
    closeNav();
  }, true);

  /* ------------------ Header scrolled state (rAF) ------------------ */
  (function () {
    const header = qs('.site-header');
    if (!header) return;
    let ticking = false;
    function update() {
      header.classList.toggle('scrolled', (window.scrollY || window.pageYOffset) > 8);
      ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    requestAnimationFrame(update);
  })();

  /* ------------------ Back to top control ------------------ */
  (function () {
    const SCROLL_THRESHOLD = 1; // show as soon as the page is scrolled down
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Return to top');
    btn.innerHTML = `<!-- up arrow -->\n<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M5 12l7-7 7 7"/></svg>`;
    document.body.appendChild(btn);

    let visible = false;
    function setVisible(v) {
      if (v === visible) return; visible = v;
      btn.classList.toggle('visible', !!v);
    }

    function check() {
      const y = window.scrollY || window.pageYOffset;
      setVisible(y > SCROLL_THRESHOLD);
    }

    btn.addEventListener('click', () => {
      const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) { window.scrollTo(0, 0); return; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    let ticking2 = false;
    window.addEventListener('scroll', () => { if (!ticking2) { ticking2 = true; requestAnimationFrame(() => { check(); ticking2 = false; }); } }, { passive: true });
    requestAnimationFrame(check);
  })();

});
