/* Arcade — game library + player.
 *
 * Add a game (in its own file, loaded after this script in arcade.html):
 *
 *   Arcade.register({
 *     id: 'snake',                 // unique, used in the URL hash (#snake)
 *     title: 'Snake',
 *     description: 'Eat, grow, survive.',
 *     genre: 'Classic',            // optional, creates a filter chip
 *     controls: 'Arrow keys / swipe',
 *     width: 640, height: 480,     // logical canvas size (scaled to fit)
 *     create(game) {               // game = { canvas, ctx, width, height, theme(), onTheme(cb), loop(fn), input }
 *       // set up state...
 *       game.loop((dt) => { ... draw with game.ctx and game.theme() colors ... });
 *       return { destroy() { ... } };   // optional cleanup
 *     }
 *   });
 *
 * theme() returns live colors from the active site theme (bg, text, muted, accent,
 * accent2, border, surface, font), so games restyle when the theme changes.
 */
(function () {
  'use strict';
  const games = [];
  const $ = (id) => document.getElementById(id);

  const Arcade = window.Arcade = {
    register(def) {
      if (!def || !def.id || (typeof def.create !== 'function' && !def.href)) return;
      if (games.some(g => g.id === def.id)) return;
      games.push(Object.assign({ width: 640, height: 480, genre: '', controls: '', description: '' }, def));
      if (ready) renderLibrary();
    }
  };

  /* ---------- Theme bridge ---------- */
  const root = document.documentElement;
  function readTheme() {
    const cs = getComputedStyle(root);
    const v = (n, d) => (cs.getPropertyValue(n) || d).trim() || d;
    return {
      bg: v('--bg', '#000'),
      surface: v('--card-surface-2', v('--bg', '#000')),
      text: v('--text', '#fff'),
      muted: v('--muted2', '#888'),
      accent: v('--accent', '#1f6feb'),
      accent2: v('--accent-2', '#5aaeff'),
      onAccent: v('--on-accent', '#fff'),
      border: v('--border-strong', '#444'),
      font: getComputedStyle(document.body).fontFamily,
      themeId: root.getAttribute('data-page-theme') || 'signature',
      dark: root.classList.contains('theme-dark') || !!root.getAttribute('data-page-theme')
    };
  }
  let themeCache = readTheme();
  const themeListeners = new Set();
  new MutationObserver(() => {
    // wait a frame so CSS variables (and rain hue) have settled
    requestAnimationFrame(() => { themeCache = readTheme(); themeListeners.forEach(cb => cb(themeCache)); });
  }).observe(root, { attributes: true, attributeFilter: ['class', 'data-page-theme', 'style'] });

  /* ---------- Player ---------- */
  let current = null;   // { def, instance, raf, off[] }
  let ready = false;

  function stop() {
    if (!current) return;
    cancelAnimationFrame(current.raf);
    current.off.forEach(fn => fn());
    try { current.instance && current.instance.destroy && current.instance.destroy(); } catch (e) { /* ignore */ }
    current = null;
  }

  function fit(def) {
    const stage = $('arcade-stage');
    const canvas = $('arcade-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxW = stage.clientWidth;
    const maxH = document.fullscreenElement === stage ? window.innerHeight : Math.max(280, window.innerHeight * 0.72);
    const s = Math.min(maxW / def.width, maxH / def.height);
    const cssW = Math.floor(def.width * s), cssH = Math.floor(def.height * s);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(def.width * dpr * (s));
    canvas.height = Math.floor(def.height * dpr * (s));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / def.width, 0, 0, canvas.height / def.height, 0, 0);
    return ctx;
  }

  function start(def) {
    stop();
    const canvas = $('arcade-canvas');
    let ctx = fit(def);
    const keys = new Set();
    const off = [];
    const on = (t, e, fn, o) => { t.addEventListener(e, fn, o); off.push(() => t.removeEventListener(e, fn, o)); };

    const game = {
      canvas, width: def.width, height: def.height,
      get ctx() { return ctx; },
      input: { keys, isDown: (k) => keys.has(k) },
      theme: () => themeCache,
      onTheme(cb) { themeListeners.add(cb); off.push(() => themeListeners.delete(cb)); },
      loop(fn) {
        let last = performance.now();
        const tick = (t) => {
          const dt = Math.min(0.05, (t - last) / 1000); last = t;
          if (!document.hidden) fn(dt);
          current && (current.raf = requestAnimationFrame(tick));
        };
        current.raf = requestAnimationFrame(tick);
      }
    };

    current = { def, instance: null, raf: 0, off };
    const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    on(window, 'keydown', (e) => {
      if (GAME_KEYS.includes(e.key) && document.activeElement === canvas) e.preventDefault();
      keys.add(e.key);
    });
    on(window, 'keyup', (e) => keys.delete(e.key));
    on(window, 'blur', () => keys.clear());
    on(window, 'resize', () => { ctx = fit(def); });
    on(document, 'fullscreenchange', () => { ctx = fit(def); });

    current.instance = def.create(game) || null;
    canvas.focus({ preventScroll: true });
  }

  function open(id, push) {
    const def = games.find(g => g.id === id);
    if (!def) return;
    if (def.href) { location.assign(def.href); return; }
    $('arcade-library').hidden = true;
    $('arcade-player').hidden = false;
    $('arcade-title').textContent = def.title;
    $('arcade-controls').textContent = def.controls ? 'Controls: ' + def.controls : '';
    if (push) history.pushState(null, '', '#' + id);
    window.scrollTo(0, 0);
    start(def);
  }

  function close(push) {
    stop();
    if (document.fullscreenElement) document.exitFullscreen();
    $('arcade-player').hidden = true;
    $('arcade-library').hidden = false;
    if (push) history.pushState(null, '', location.pathname);
  }

  /* ---------- Library ---------- */
  // Native disclosure keeps information and update history accessible without a modal.
  function gameInfo(game) {
    const details = document.createElement('details');
    details.className = 'arcade-info';
    const summary = document.createElement('summary');
    summary.textContent = 'Info & updates';
    summary.setAttribute('aria-label', 'Info and updates for ' + game.title);
    const body = document.createElement('div'); body.className = 'arcade-info-body';
    const heading = text => { const el = document.createElement('h4'); el.textContent = text; body.append(el); };
    const paragraph = text => { const el = document.createElement('p'); el.textContent = text; body.append(el); };
    heading('About ' + game.title);
    (game.info.about || []).forEach(paragraph);
    if (game.info.controls) { heading('Controls'); paragraph(game.info.controls); }
    if (game.info.updates?.length) {
      heading('Updates');
      game.info.updates.forEach(update => {
        const title = document.createElement('h5'); title.textContent = update.title; body.append(title);
        const list = document.createElement('ul');
        update.items.forEach(text => { const item = document.createElement('li'); item.textContent = text; list.append(item); });
        body.append(list);
      });
    }
    details.append(summary, body);
    return details;
  }

  let libraryCards = [], libraryColumns = 0;
  function layoutLibrary() {
    const grid = $('arcade-grid');
    if (!grid.clientWidth) return;
    const count = window.matchMedia('(max-width:600px)').matches ? 1 : Math.max(1, Math.floor((grid.clientWidth + 24) / 284));
    if (count === libraryColumns) return;
    libraryColumns = count;
    const columns = Array.from({ length: count }, () => {
      const col = document.createElement('div'); col.className = 'arcade-column'; return col;
    });
    libraryCards.forEach((card, i) => columns[i % count].append(card));
    grid.replaceChildren(...columns);
  }

  let genre = 'all';
  function renderLibrary() {
    const grid = $('arcade-grid');
    const genres = Array.from(new Set(games.map(g => g.genre).filter(Boolean)));
    const bar = $('arcade-filters');
    const chips = $('arcade-genres');
    bar.hidden = genres.length < 2;
    chips.innerHTML = '';
    ['all'].concat(genres).forEach(gn => {
      const b = document.createElement('button');
      b.className = 'filter-chip' + (gn === genre ? ' active' : '');
      b.type = 'button';
      b.textContent = gn === 'all' ? 'All' : gn;
      b.setAttribute('aria-pressed', String(gn === genre));
      b.addEventListener('click', () => { genre = gn; renderLibrary(); });
      chips.appendChild(b);
    });

    grid.innerHTML = '';
    libraryCards = []; libraryColumns = 0;
    const list = games.filter(g => genre === 'all' || g.genre === genre);
    list.forEach(g => {
      const card = document.createElement('article');
      card.className = 'project-card project arcade-card';
      const h = document.createElement('h3'); h.textContent = g.title;
      const p = document.createElement('p'); p.textContent = g.description;
      const a = document.createElement('p'); a.className = 'repo-link';
      const btn = document.createElement(g.href ? 'a' : 'button');
      btn.className = 'btn btn-primary'; btn.type = 'button'; btn.textContent = 'Play';
      if (g.href) btn.href = g.href;
      else btn.addEventListener('click', () => open(g.id, true));
      a.appendChild(btn);
      card.append(h);
      if (g.releaseDate) {
        const date = new Date(g.releaseDate + 'T00:00:00Z');
        if (Number.isFinite(date.getTime())) {
          const released = document.createElement('time');
          released.className = 'arcade-release'; released.dateTime = g.releaseDate;
          released.textContent = 'Released ' + new Intl.DateTimeFormat('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
          }).format(date);
          card.append(released);
        }
      }
      card.append(p, a);
      if (g.info) card.append(gameInfo(g));
      libraryCards.push(card);
    });
    layoutLibrary();
    $('arcade-empty').hidden = games.length > 0;
  }

  /* ---------- Wiring ---------- */
  function init() {
    ready = true;
    renderLibrary();
    new ResizeObserver(layoutLibrary).observe($('arcade-grid'));
    $('arcade-back').addEventListener('click', () => close(true));
    $('arcade-restart').addEventListener('click', () => current && start(current.def));
    $('arcade-full').addEventListener('click', () => {
      const stage = $('arcade-stage');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen();
    });
    window.addEventListener('popstate', () => {
      const id = location.hash.slice(1);
      if (id) open(id, false); else close(false);
    });
    if (location.hash.length > 1) open(location.hash.slice(1), false);
  }
  // Games register synchronously from later <script> tags, so wait for load.
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
