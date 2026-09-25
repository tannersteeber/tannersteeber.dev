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

  // helper to find all theme toggle buttons (now moved into popup)
  const getToggles = () => qsa('.theme-toggle');

  function applyTheme(theme) {
    const dark = theme === 'dark';
    root.classList.toggle('theme-dark', dark);
  getToggles().forEach(btn => btn.setAttribute('aria-pressed', dark ? 'true' : 'false'));
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  function initTheme() {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (stored) { applyTheme(stored); return; }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  // wire toggle buttons (attach to current toggles; popup may add/remove them)
  function wireToggles() {
    getToggles().forEach(btn => {
      if (btn._wired) return; // avoid duplicate listeners
      btn.addEventListener('click', () => { const nowDark = root.classList.contains('theme-dark'); applyTheme(nowDark ? 'light' : 'dark'); });
      btn._wired = true;
    });
  }

  initTheme();

  // ensure toggles inside popup are wired when popup is first used
  wireToggles();

  /* ------------------ Overlay navigation ------------------ */
  /* ------------------ Compact popup menu (desktop & mobile) ------------------ */
  const popup = qs('#popup-menu');
  const popupNav = qs('.popup-nav');
  const headerNav = qs('.nav');
  const popupClose = qs('.popup-close');
  const headerToggles = qsa('.nav-toggle');
  const mobileToggle = qs('.mobile-nav-toggle');
  const MOBILE_SIDE_KEY = 'mobile-hamburger-side'; // 'right' or 'left'

  // apply stored mobile side preference
  function applyMobileSide(side) {
    if (!mobileToggle) return;
    if (side === 'left') mobileToggle.classList.add('left'); else mobileToggle.classList.remove('left');
  // remove any inline positioning so CSS can handle it
  mobileToggle.style.left = '';
  mobileToggle.style.right = '';
    // if popup is currently open on mobile, reposition it to remain above the button
    try {
      if (popup && popup.classList.contains('open') && window.innerWidth < 900) {
        const rect = mobileToggle.getBoundingClientRect();
        const sideLeft = mobileToggle.classList.contains('left');
        if (sideLeft) {
          popup.style.left = (rect.left) + 'px';
          popup.style.right = '';
        } else {
          popup.style.right = (window.innerWidth - rect.right) + 'px';
          popup.style.left = '';
        }
        const top = Math.max(12, rect.top - (popup.offsetHeight + 8));
        popup.style.top = top + 'px';
      }
    } catch (e) { /* ignore */ }
  }

  // initialize side preference
  (function initMobileSide() {
    try {
      const s = localStorage.getItem(MOBILE_SIDE_KEY) || 'right';
      applyMobileSide(s);
    } catch (e) {}
  })();

  function syncNav() {
    if (!popupNav || !headerNav) return;
    popupNav.innerHTML = headerNav.innerHTML;
    // mark active links inside popup
    qsa('a', popupNav).forEach(a => {
      try {
        if (location.pathname === new URL(a.href, location.origin).pathname) a.classList.add('active');
      } catch (e) { /* ignore invalid URLs */ }
    });
    // If mobile viewport, inject side toggle button into the popup theme row (next to the theme toggle)
    const settings = qs('.popup-settings', popup);
    if (settings && window.innerWidth < 900) {
      const popupTheme = qs('.popup-theme', settings);
      if (popupTheme && !qs('.side-switch', popupTheme)) {
        const side = (function(){ try { return localStorage.getItem(MOBILE_SIDE_KEY) || 'right'; } catch(e){ return 'right'; }})();
        // SVGs: left arrow and right arrow
        const leftSVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
        const rightSVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
        const btn = document.createElement('button');
        btn.className = 'side-switch';
        btn.setAttribute('aria-pressed', side === 'left' ? 'true' : 'false');
        btn.setAttribute('aria-label', 'Move menu side');
        btn.title = 'Move menu side';
        btn.innerHTML = side === 'left' ? leftSVG : rightSVG;
        popupTheme.appendChild(btn);
        btn.addEventListener('click', () => {
          const nowLeft = btn.getAttribute('aria-pressed') === 'true';
          const newSide = nowLeft ? 'right' : 'left';
          try { localStorage.setItem(MOBILE_SIDE_KEY, newSide); } catch(e){}
          btn.setAttribute('aria-pressed', String(!nowLeft));
          btn.innerHTML = newSide === 'left' ? leftSVG : rightSVG;
          applyMobileSide(newSide);
        });
      }
    }
  }

  function openPopup(anchorRect) {
    if (!popup) return;
    syncNav();
  // make sure newly-inserted toggles in the popup are wired
  wireToggles();
    popup.classList.add('open');
    popup.setAttribute('aria-hidden', 'false');
    // Desktop: anchored top-right via CSS. For mobile we position above the mobile button if provided.
    if (anchorRect && window.innerWidth < 900) {
      // position popup so it sits above the mobile button; account for left/right placement
      const sideLeft = mobileToggle && mobileToggle.classList.contains('left');
      if (sideLeft) {
        popup.style.left = (anchorRect.left) + 'px';
        popup.style.right = '';
      } else {
        popup.style.right = (window.innerWidth - (anchorRect.right)) + 'px';
        popup.style.left = '';
      }
      const top = Math.max(12, anchorRect.top - (popup.offsetHeight + 8));
      popup.style.top = top + 'px';
    } else {
      // clear inline positioning to allow CSS anchoring
      popup.style.top = '';
      popup.style.right = '';
      popup.style.left = '';
    }
    // trap scroll behind the popup on small screens for focus effect
    if (window.innerWidth < 900) document.documentElement.style.overflow = 'hidden';
  }

  function closePopup() {
    if (!popup) return;
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
    popup.style.top = '';
    popup.style.right = '';
    document.documentElement.style.overflow = '';
  }

  // Wire header and mobile toggles
  headerToggles.forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); openPopup(); }));
  if (mobileToggle) {
    mobileToggle.addEventListener('click', (e) => {
      e.preventDefault();
      // If popup is already open, close it. Otherwise open anchored to the mobile button.
      if (popup && popup.classList.contains('open')) {
        closePopup();
      } else {
        openPopup(mobileToggle.getBoundingClientRect());
      }
    });
  }
  popupClose && popupClose.addEventListener('click', closePopup);

  // Close popup when clicking a nav link or outside
  document.addEventListener('click', (e) => {
    if (!popup || !popup.classList.contains('open')) return;
    const target = e.target;
    if (popup.contains(target)) {
      const a = target.closest && target.closest('a');
      if (a && popup.contains(a)) return closePopup();
      return; // clicks inside popup shouldn't close unless on a link or close button
    }
    // ignore clicks on toggles that open it
    if (target.closest && target.closest('.nav-toggle')) return;
    closePopup();
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

  /* ------------------ Projects columns: per-column scroll recall & top buttons ------------------ */
  (function () {
    // Persist scroll position for each project-list so the column remembers where you left off
    ['public-list','private-list'].forEach(id => {
      const list = qs(`#${id}`);
      if (!list) return;
      const key = `scroll-pos:${id}`;
      try {
        const val = sessionStorage.getItem(key);
        if (val) list.scrollTop = parseInt(val, 10);
      } catch (e) {}
      let t = null;
      list.addEventListener('scroll', () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => { try { sessionStorage.setItem(key, String(list.scrollTop)); } catch (e) {} }, 150);
      }, { passive: true });
    });
  })();

  /* project-list column containment removed — projects are now simple lists */

  /* ------------------ Featured project on home page ------------------ */
  (function () {
    const featured = qs('#featured-project');
    if (!featured) return;

    // Use data-target on the featured element if present (explicit project ID), otherwise fall back to DOM lookup
    const dataTarget = featured.getAttribute('data-target');
    let id = dataTarget || '';
    let title = featured.querySelector('.featured-title') ? featured.querySelector('.featured-title').textContent.trim() : 'Project';
    let meta = featured.querySelector('.featured-meta') ? featured.querySelector('.featured-meta').textContent.trim() : '';
    let desc = featured.querySelector('.featured-desc') ? featured.querySelector('.featured-desc').textContent.trim() : '';

    if (!id) {
      // Prefer the manually-picked featured project by id, otherwise fall back to first public project
      let firstProject = document.getElementById('project-tannersteeber-dev');
      if (!firstProject) {
        const publicList = qs('#public-list');
        if (publicList) firstProject = publicList.querySelector('article.project-card');
      }
      if (firstProject) {
        title = firstProject.querySelector('h3') ? firstProject.querySelector('h3').textContent.trim() : title;
        meta = firstProject.querySelector('.meta') ? firstProject.querySelector('.meta').textContent.trim() : meta;
        desc = firstProject.querySelector('p') ? firstProject.querySelector('p').textContent.trim() : desc;
        id = firstProject.id || '';
      }
    }

    // populate the featured card
    const fTitle = featured.querySelector('.featured-title');
    const fMeta = featured.querySelector('.featured-meta');
    const fDesc = featured.querySelector('.featured-desc');
    if (fTitle) fTitle.textContent = title;
    if (fMeta) fMeta.textContent = meta;
    if (fDesc) fDesc.textContent = desc;

    function openProject() {
      // if we're already on the projects page, just expand the project
      if (location.pathname.endsWith('projects.html')) {
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        const details = target.querySelector('details.card-details');
        if (details && !details.open) details.open = true;
        // scroll into view
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
        return;
      }

      // otherwise, navigate to projects page with hash and let projects page handle expansion on load
      // Build a base-path-aware URL so navigation works when the site is served from a subpath
      const pathBase = (function () {
        // If the pathname ends with a slash, use it directly; otherwise strip the last path segment (file) to get the base folder
        if (location.pathname.endsWith('/')) return location.pathname;
        return location.pathname.replace(/\/[^/]*$/, '/');
      })();

      const dest = pathBase + 'projects.html' + (id ? `#${id}` : '');
      return location.assign(location.origin + dest);
    }

    featured.addEventListener('click', openProject);
    featured.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(); } });
  })();

  /* Expand project when landing on projects.html with a hash (e.g., /projects.html#project-id) */
  (function () {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    if (!id) return;
    // wait a tick for the DOM to be ready
    setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      const details = target.querySelector('details.card-details');
      if (details && !details.open) details.open = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  })();

  /* ------------------ Lightbox for project screenshots ------------------ */
  (function () {
    const lightbox = qs('#lightbox');
    if (!lightbox) return;
  // lbImg was used for single-image lightbox; the carousel uses a track instead
  // Keep reference for legacy fallbacks if needed (unused currently)
  const lbImg = qs('.lb-img', lightbox);
    const lbPrev = qs('.lb-prev', lightbox);
    const lbNext = qs('.lb-next', lightbox);
    const lbClose = qs('.lb-close', lightbox);
    const lbCounter = qs('.lb-counter', lightbox);

  // We'll build per-gallery dark/light pairs when a thumbnail is clicked
  // so the lightbox only contains images from the gallery that was opened.
  let pairs = [];
  let currentThumbs = [];
  let idx = 0;

    function getSrcForIndex(i) {
      const p = pairs[i] || {};
      const darkMode = root.classList.contains('theme-dark');
      if (darkMode) return p.dark || p.light || '';
      return p.light || p.dark || '';
    }

    function open(i) {
      idx = Number.isFinite(i) ? i : 0;
      // build a scroll-snap track and show it
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      buildTrack();
      const track = qs('.lb-track', lightbox);
      if (track) {
        // ensure resize observer is watching the track so we can re-center
        trackResizeObserver.disconnect();
        trackResizeObserver.observe(track);
      }
      // update counter and scroll to the selected index
      lbCounter.textContent = `${idx + 1} / ${pairs.length}`;
      // Defer scroll so layout is ready
      setTimeout(() => scrollToIndex(idx, 'instant'), 40);
    }

    function close() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      const track = qs('.lb-track', lightbox);
      if (track) {
  trackResizeObserver.disconnect();
  track._cleanupVerticalClose && track._cleanupVerticalClose();
  if (track._io) try { track._io.disconnect(); } catch (e) {}
  track._cleanupInnerClick && track._cleanupInnerClick();
      }
      // clear media content
      const media = qs('.lb-media', lightbox);
      if (media) media.innerHTML = '';
    }

  function next() { idx = (idx + 1) % pairs.length; scrollToIndex(idx); }
  function prev() { idx = (idx - 1 + pairs.length) % pairs.length; scrollToIndex(idx); }

    // wire gallery thumbnails: when a thumb is clicked, build the
    // list of thumbnails for that gallery and open the lightbox for the
    // clicked index. This prevents thumbnails from other cards from
    // contributing to the gallery size.
    qsa('.card-gallery .thumbs .thumb').forEach((t) => {
      t.style.cursor = 'pointer';
      t.addEventListener('click', () => {
        const gallery = t.closest('.card-gallery');
        if (!gallery) return;
        const thumbsContainer = gallery.querySelector('.thumbs');
        const tlist = Array.from(thumbsContainer.querySelectorAll('.thumb'));
        currentThumbs = tlist;
        pairs = tlist.map(tt => ({
          dark: (tt.querySelector('.img-dark') && tt.querySelector('.img-dark').src) || '',
          light: (tt.querySelector('.img-light') && tt.querySelector('.img-light').src) || ''
        }));
  const localIndex = tlist.indexOf(t);
  open(localIndex);
      });
    });

    // observe theme changes on <html> so we can update track images
    const mo = new MutationObserver(() => {
      if (!lightbox.classList.contains('open')) return;
      updateTrackForTheme();
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });

    // controls
    lbClose.addEventListener('click', close);
    lbNext.addEventListener('click', next);
    lbPrev.addEventListener('click', prev);
    lightbox.querySelector('.lightbox-backdrop').addEventListener('click', close);

    // When user scrolls the track (native swipe/scroll), update idx and counter
    function onTrackScroll() {
      const track = qs('.lb-track', lightbox);
      if (!track) return;
      const left = track.scrollLeft;
      let closest = 0;
      let closestDist = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const dist = Math.abs(child.offsetLeft - left);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      if (closest !== idx) {
        idx = closest;
        lbCounter.textContent = `${idx + 1} / ${pairs.length}`;
      }
    }

    // Debounced scroll listener for track
    let scrollTimer = null;
    function attachTrackScrollListener() {
      const track = qs('.lb-track', lightbox);
      if (!track) return;
      track.removeEventListener('scroll', onTrackScroll);
      track.addEventListener('scroll', () => {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(onTrackScroll, 80);
      }, { passive: true });
    }

    // keyboard
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });

    // Replace previous gesture handlers with a scroll-snap carousel.
    // The carousel allows natural horizontal swipe/scroll on touch and
    // trackpad, and click-drag on desktop (depending on browser). Arrows
    // and keyboard navigation still call next/prev which scroll the track.

    // Build the horizontal track inside .lb-media for the current `pairs`.
    function buildTrack() {
      const media = qs('.lb-media', lightbox);
      media.innerHTML = '';
      const track = document.createElement('div');
      track.className = 'lb-track';
      pairs.forEach((p, i) => {
        const img = document.createElement('img');
        img.className = 'lb-track-img';
        img.dataset.dark = p.dark || '';
        img.dataset.light = p.light || '';
        img.src = getSrcForIndex(i);
        img.alt = `Screenshot ${i + 1}`;
        track.appendChild(img);
      });
      media.appendChild(track);
      // return the track element
      // attach scroll listener
      // Attach vertical-scroll/touch-to-close behavior
      const touchState = { startX: 0, startY: 0, active: false };

      function onTouchStart(e) {
        touchState.active = true;
        const t = e.touches && e.touches[0];
        touchState.startX = t ? t.clientX : 0;
        touchState.startY = t ? t.clientY : 0;
      }

      function onTouchMove(e) {
        if (!touchState.active) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const dx = t.clientX - touchState.startX;
        const dy = t.clientY - touchState.startY;
        // mostly vertical movement and beyond threshold => close
        if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
          e.preventDefault && e.preventDefault();
          touchState.active = false;
          close();
        }
      }

      function onTouchEnd() { touchState.active = false; }

      function onWheel(e) {
        // If the wheel event is mostly vertical, close the lightbox.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && Math.abs(e.deltaY) > 20) {
          e.preventDefault && e.preventDefault();
          close();
        }
      }

      track.addEventListener('touchstart', onTouchStart, { passive: true });
      track.addEventListener('touchmove', onTouchMove, { passive: false });
      track.addEventListener('touchend', onTouchEnd, { passive: true });
      track.addEventListener('wheel', onWheel, { passive: false });

      track._cleanupVerticalClose = () => {
        track.removeEventListener('touchstart', onTouchStart);
        track.removeEventListener('touchmove', onTouchMove);
        track.removeEventListener('touchend', onTouchEnd);
        track.removeEventListener('wheel', onWheel);
      };

      // IntersectionObserver to detect which slide is currently in view
      const io = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          const children = Array.from(track.children);
          const i = children.indexOf(en.target);
          if (i >= 0 && i !== idx) {
            idx = i;
            lbCounter.textContent = `${idx + 1} / ${pairs.length}`;
          }
        });
      }, { root: track, threshold: 0.6 });
      Array.from(track.children).forEach(child => io.observe(child));
      track._io = io;

      // Clicking in the inner area but outside the image or controls should close
      const inner = qs('.lightbox-inner', lightbox);
      function onInnerClick(e) {
        // If click is on an image or on any control, don't close
        if (e.target.closest && (e.target.closest('.lb-track-img') || e.target.closest('.lb-prev') || e.target.closest('.lb-next') || e.target.closest('.lb-close'))) return;
        close();
      }
      if (inner) {
        inner.addEventListener('click', onInnerClick);
        track._cleanupInnerClick = () => inner.removeEventListener('click', onInnerClick);
      }
      return track;
    }

  // mouse/drag handlers removed — rely on native scroll-snap behavior

    // Scroll to a specific index in the track (centers the child)
    function scrollToIndex(i, behavior = 'smooth') {
      const track = qs('.lb-track', lightbox);
      if (!track) return;
      const child = track.children[i];
      if (!child) return;
      const left = child.offsetLeft;
      track.scrollTo({ left, behavior });
      idx = i;
      lbCounter.textContent = `${idx + 1} / ${pairs.length}`;
    }

    // Update image srcs for theme changes
    function updateTrackForTheme() {
      const track = qs('.lb-track', lightbox);
      if (!track) return;
      Array.from(track.children).forEach((img, i) => {
        const p = pairs[i] || {};
        img.src = getSrcForIndex(i);
      });
    }

    // When user opens the lightbox, build the track and snap to the index
    const trackResizeObserver = new ResizeObserver(() => {
      // keep current index centered if layout changes
      scrollToIndex(idx, 'instant');
    });
  // disconnect observer when lightbox closed
  lightbox.addEventListener('transitionend', () => { if (!lightbox.classList.contains('open')) mo.disconnect(); });
  })();
});
