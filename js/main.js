/*
 * main.js - Clean unified client behaviors
 * - data-year injection
 * - theme system (persisted + respects prefers-color-scheme)
 * - overlay navigation (clone + open/close)
 * - header scrolled state via rAF
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const qs = (s, ctx = document) => ctx.querySelector(s);
  const qsa = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  // Year injection: write current year into all [data-year]
  const YEAR = new Date().getFullYear();
  qsa('[data-year]').forEach(el => el.textContent = YEAR);

  /* ---------------- Theme system ---------------- */
  const root = document.documentElement;
  const THEME_KEY = 'site-theme';
  const toggles = qsa('.theme-toggle');

  function applyTheme(theme){
    const dark = theme === 'dark';
    root.classList.toggle('theme-dark', dark);
    toggles.forEach(btn => btn.setAttribute('aria-pressed', dark ? 'true' : 'false'));
    try{ localStorage.setItem(THEME_KEY, theme); } catch(e){}
  }

  function initTheme(){
    let stored = null;
    try{ stored = localStorage.getItem(THEME_KEY); } catch(e){}
    if(stored){ applyTheme(stored); return; }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  toggles.forEach(btn => btn.addEventListener('click', () => {
    const nowDark = root.classList.contains('theme-dark');
    applyTheme(nowDark ? 'light' : 'dark');
  }));

  initTheme();

  /* ---------------- Overlay navigation ---------------- */
  const overlay = qs('.nav-overlay');
  const overlayNav = qs('.overlay-nav');
  const headerNav = qs('.nav');
  const overlayClose = qs('.overlay-close');

  function syncNav(){
    if(!overlayNav || !headerNav) return;
    overlayNav.innerHTML = headerNav.innerHTML;
    // mark active links inside overlay
    qsa('a', overlayNav).forEach(a => {
      try{
        if(location.pathname === new URL(a.href, location.origin).pathname) a.classList.add('active');
      }catch(e){}
    });
  }

  function openNav(){ if(overlay) { overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); document.documentElement.style.overflow='hidden'; } }
  function closeNav(){ if(overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); document.documentElement.style.overflow=''; } }

  syncNav();
  // wire toggles
  qsa('.nav-toggle').forEach(b => b.addEventListener('click', openNav));
  overlayClose && overlayClose.addEventListener('click', closeNav);

  // clicking overlay backdrop or any area outside the centered nav closes it
  overlay && overlay.addEventListener('click', (e) => {
    if(!overlayNav) return;
    // if the click is anywhere that is not inside the overlayNav, close
    if(!overlayNav.contains(e.target)) closeNav();
    // if the click was on a link inside the overlayNav, allow navigation but still close
    const a = e.target.closest && e.target.closest('a');
    if(a && overlayNav.contains(a)) closeNav();
  });

  // In some environments a global click is more reliable; close overlay when it's open
  // and the user clicks anywhere outside the overlay nav (ignores clicks on nav-toggle).
  document.addEventListener('click', (e) => {
    if(!overlay || !overlay.classList.contains('open')) return;
    const target = e.target;
    if(!overlayNav) return closeNav();
    // ignore clicks inside the overlay nav or on the nav toggle buttons
    if(overlayNav.contains(target) || target.closest('.nav-toggle')) return;
    closeNav();
  }, true);

  /* ---------------- Header scrolled state (rAF) ---------------- */
  (function(){
    const header = qs('.site-header');
    if(!header) return;
    let ticking = false;
    function update(){
      header.classList.toggle('scrolled', (window.scrollY || window.pageYOffset) > 8);
      ticking = false;
    }
    window.addEventListener('scroll', () => { if(!ticking){ ticking = true; requestAnimationFrame(update); } });
    requestAnimationFrame(update);
  })();

});
