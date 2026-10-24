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

  /* ------------------ Signature (swaps in for the text name once the image is available) ------------------ */
  qsa('.signature-img').forEach(el => {
    const probe = new Image();
    probe.onload = () => el.parentNode.classList.add('has-signature');
    probe.src = 'assets/signature.png?v=3';
  });

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
  const CORNER_KEY = 'mobile-hamburger-corner'; // tr | tl | br | bl

  // Apply a corner to the floating mobile button (classes drive CSS placement)
  function applyCorner(corner) {
    if (!mobileToggle) return;
    mobileToggle.classList.toggle('left', corner[1] === 'l');
    mobileToggle.classList.toggle('bottom', corner[0] === 'b');
    // brand moves to the right only when the button is at the top-left
    document.documentElement.classList.toggle('menu-tl', corner === 'tl');
    mobileToggle.style.left = mobileToggle.style.top = mobileToggle.style.right = mobileToggle.style.bottom = '';
  }

  // Position the popup against its button: below it at the top, above it at the bottom.
  // A caret on the popup points at the button, and the popup grows out of that point.
  function placePopup(anchor) {
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const mobile = vw < 900;
    const above = mobile && mobileToggle.classList.contains('bottom');
    // never let the menu reach the button: cap its height to the free space on its side
    const room = (above ? rect.top : window.innerHeight - rect.bottom) - 12 - 8;
    popup.style.setProperty('--pop-max', Math.max(160, room) + 'px');
    const w = popup.offsetWidth, h = popup.offsetHeight;
    const cx = rect.left + rect.width / 2;
    const rightSide = cx > vw / 2;
    // line the menu up with the button's edge on every screen size so it stays attached to it
    let left = rightSide ? rect.right - w : rect.left;
    left = Math.max(12, Math.min(left, vw - w - 12));
    const top = Math.max(8, above ? rect.top - h - 12 : rect.bottom + 12);
    const caret = Math.max(24, Math.min(cx - left, w - 24));
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.style.right = 'auto';
    popup.style.setProperty('--caret-x', caret + 'px');
    popup.style.transformOrigin = caret + 'px ' + (above ? '100%' : '0');
    popup.classList.toggle('from-bottom', above);
  }

  // Drag (mouse or touch) the button to any corner; it snaps on release
  (function initDrag() {
    if (!mobileToggle) return;
    try { applyCorner(localStorage.getItem(CORNER_KEY) || 'tr'); } catch (e) { applyCorner('tr'); }
    let start = null, dragged = false;
    mobileToggle.addEventListener('pointerdown', (e) => {
      const r = mobileToggle.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top };
      dragged = false;
      mobileToggle.setPointerCapture(e.pointerId);
    });
    mobileToggle.addEventListener('pointermove', (e) => {
      if (!start) return;
      if (!dragged && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
      if (!dragged) { dragged = true; mobileToggle.classList.add('dragging'); closePopup(); }
      mobileToggle.style.right = mobileToggle.style.bottom = 'auto';
      mobileToggle.style.left = (e.clientX - start.dx) + 'px';
      mobileToggle.style.top = (e.clientY - start.dy) + 'px';
    });
    const end = (e) => {
      if (!start) return;
      start = null;
      if (!dragged) return;
      const r = mobileToggle.getBoundingClientRect();
      const corner = (r.top + r.height / 2 < window.innerHeight / 2 ? 't' : 'b') +
                     (r.left + r.width / 2 < window.innerWidth / 2 ? 'l' : 'r');
      mobileToggle.classList.remove('dragging');
      applyCorner(corner);
      try { localStorage.setItem(CORNER_KEY, corner); } catch (err) {}
      setTimeout(() => { dragged = false; }, 0);
    };
    mobileToggle.addEventListener('pointerup', end);
    mobileToggle.addEventListener('pointercancel', end);
    // swallow the click that follows a drag
    mobileToggle.addEventListener('click', (e) => { if (dragged) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  })();

  /* ------------------ Page themes (Signature default, Retro, Digital Rain) ------------------ */
  const PAGE_THEMES = [
    { id: 'signature', label: 'Signature' },
    { id: 'retro', label: 'Retro' },
    { id: 'rain', label: 'Digital Rain' }
  ];
  const PAGE_THEME_KEY = 'page-theme';
  let rainTimer = null, rainCanvas = null;

  function stopRain() {
    if (rainTimer) { clearInterval(rainTimer); rainTimer = null; }
    if (rainCanvas) { rainCanvas.remove(); rainCanvas = null; }
  }

  // Falling binary characters behind the page (Digital Rain only)
  function startRain() {
    stopRain();
    rainCanvas = document.createElement('canvas');
    rainCanvas.className = 'rain-canvas';
    rainCanvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(rainCanvas);
    const ctx = rainCanvas.getContext('2d');
    const size = 16;
    let cols = 0, drops = [];
    const resize = () => {
      rainCanvas.width = window.innerWidth;
      rainCanvas.height = window.innerHeight;
      cols = Math.ceil(rainCanvas.width / size);
      drops = Array.from({ length: cols }, () => Math.random() * -40);
    };
    resize();
    window.addEventListener('resize', resize);
    const step = () => {
      if (document.hidden) return;
      const h = root.style.getPropertyValue('--rain-h') || 144;
      ctx.fillStyle = 'hsla(' + h + ',90%,2%,.14)';
      ctx.fillRect(0, 0, rainCanvas.width, rainCanvas.height);
      ctx.fillStyle = 'hsl(' + h + ',100%,61%)';
      ctx.font = size + 'px monospace';
      for (let i = 0; i < cols; i++) {
        if (drops[i] > 0) ctx.fillText(Math.random() > .5 ? '1' : '0', i * size, drops[i] * size);
        if (drops[i] * size > rainCanvas.height && Math.random() > .975) drops[i] = 0;
        drops[i] += 1;
      }
    };
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { for (let n = 0; n < 60; n++) step(); return; } // static frame only
    rainTimer = setInterval(step, 70);
  }

  function applyPageTheme(id) {
    if (!PAGE_THEMES.some(t => t.id === id)) id = 'signature';
    if (id === 'signature') root.removeAttribute('data-page-theme');
    else root.setAttribute('data-page-theme', id);
    if (id === 'rain') startRain(); else stopRain();
    qsa('.popup-pagethemes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pageTheme === id)));
    try { localStorage.setItem(PAGE_THEME_KEY, id); } catch (e) { /* ignore */ }
  }

  // Build the picker inside the popup's settings area
  (function initPageThemePicker() {
    const settings = popup && qs('.popup-settings', popup);
    if (!settings) return;
    const label = document.createElement('h4');
    label.className = 'pagetheme-label';
    label.textContent = 'Page theme';
    const group = document.createElement('div');
    group.className = 'popup-pagethemes';
    PAGE_THEMES.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.pageTheme = t.id;
      b.textContent = t.label;
      b.addEventListener('click', () => {
        // clicking Digital Rain while it is already active resets it to the original green
        if (t.id === 'rain' && root.getAttribute('data-page-theme') === 'rain') {
          hue.value = '144';
          root.style.setProperty('--rain-h', '144');
          try { localStorage.setItem('rain-hue', '144'); } catch (e) { /* ignore */ }
          return;
        }
        applyPageTheme(t.id);
      });
      group.appendChild(b);
    });
    settings.append(label, group);

    // Digital Rain colour slider (shown by CSS only while that theme is active)
    const HUE_KEY = 'rain-hue';
    const hueWrap = document.createElement('div');
    hueWrap.className = 'popup-rainhue';
    const hueLabel = document.createElement('h4');
    hueLabel.className = 'pagetheme-label';
    hueLabel.textContent = 'Rain color';
    const hue = document.createElement('input');
    hue.type = 'range'; hue.min = '0'; hue.max = '360'; hue.step = '1';
    hue.setAttribute('aria-label', 'Digital Rain color');
    let savedHue = '144';
    try { savedHue = localStorage.getItem(HUE_KEY) || '144'; } catch (e) { /* ignore */ }
    hue.value = savedHue;
    root.style.setProperty('--rain-h', savedHue);
    hue.addEventListener('input', () => {
      root.style.setProperty('--rain-h', hue.value);
      try { localStorage.setItem(HUE_KEY, hue.value); } catch (e) { /* ignore */ }
    });
    hueWrap.append(hueLabel, hue);
    settings.append(hueWrap);
    let stored = null;
    try { stored = localStorage.getItem(PAGE_THEME_KEY); } catch (e) { /* ignore */ }
    applyPageTheme(stored || 'signature');
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
  }

  function openPopup(anchor) {
    if (!popup) return;
    syncNav();
    wireToggles();
    popup.classList.add('open', 'opening');
    popup.setAttribute('aria-hidden', 'false');
    setTimeout(() => popup.classList.remove('opening'), 400);
    // measure and place before the next paint so it never appears in the wrong spot
    if (anchor) placePopup(anchor);
    // trap scroll behind the popup on small screens
    if (window.innerWidth < 900) document.documentElement.style.overflow = 'hidden';
  }

  function closePopup() {
    if (!popup) return;
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  // Wire header and mobile toggles
  headerToggles.forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    if (popup && popup.classList.contains('open')) closePopup(); else openPopup(b);
  }));
  if (mobileToggle) {
    mobileToggle.addEventListener('click', (e) => {
      e.preventDefault();
      // If popup is already open, close it. Otherwise open anchored to the mobile button.
      if (popup && popup.classList.contains('open')) {
        closePopup();
      } else {
        openPopup(mobileToggle);
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
    if (target.closest && target.closest('.nav-toggle, .mobile-nav-toggle')) return;
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

  /* ------------------ Projects: filter by status tab + type ------------------ */
  (function () {
    const grid = qs('#project-grid');
    if (!grid) return;
    const cards = qsa('.project-card', grid);
    const empty = qs('.project-empty', grid);
    const state = { status: 'all', type: 'all' };

    function apply() {
      let shown = 0;
      cards.forEach(c => {
        const ok = (state.status === 'all' || c.dataset.status === state.status) &&
                   (state.type === 'all' || c.dataset.type === state.type);
        c.hidden = !ok;
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      layout();
    }

    // Independent columns: expanding a card only pushes down cards in its own column
    const mq = window.matchMedia('(max-width:900px)');
    let cols = [];
    function layout() {
      const n = mq.matches ? 1 : 2;
      cols.forEach(c => c.remove());
      cols = [];
      for (let i = 0; i < n; i++) {
        const col = document.createElement('div');
        col.className = 'project-col';
        grid.insertBefore(col, empty || null);
        cols.push(col);
      }
      cards.filter(c => !c.hidden).forEach((c, i) => cols[i % n].appendChild(c));
      cards.filter(c => c.hidden).forEach(c => cols[0].appendChild(c));
    }
    mq.addEventListener && mq.addEventListener('change', layout);

    qsa('[data-filter-status]').forEach(btn => btn.addEventListener('click', () => {
      state.status = btn.dataset.filterStatus;
      qsa('[data-filter-status]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      apply();
    }));

    qsa('[data-filter-type]').forEach(btn => btn.addEventListener('click', () => {
      state.type = btn.dataset.filterType;
      qsa('[data-filter-type]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      apply();
    }));
    apply();
  })();

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
        const publicList = qs('#project-grid');
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
