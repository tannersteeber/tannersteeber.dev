/* GameMenu — title, pause and game-over screens. */
import { h } from './dom.js';

export class GameMenu {
  /**
   * cfg: { title, tagline, backHref, controlsExtra: [[key, text]], onPlay, onResume, onRestart, onSettings, onClick }
   */
  constructor(root, settings, cfg) {
    this.cfg = cfg; this.settings = settings;
    this.screens = {};
    this.layer = h('div', { class: 'g-menu', 'data-ui': '' });
    root.append(this.layer);
    this._build();
  }

  _btn(text, fn, primary) {
    return h('button', { class: 'g-btn' + (primary ? ' g-btn-primary' : ''), type: 'button', onclick: () => { this.cfg.onClick && this.cfg.onClick(); fn(); } }, text);
  }

  controlsList() {
    const mode = this.settings.controlMode();
    const rows = [];
    if (mode === 'keyboard') rows.push(['A / D  or  ← / →', 'Steer']);
    else if (mode === 'mouse') rows.push(['Hold left / right half', 'Steer with the mouse']);
    else if (mode === 'touch') rows.push(['Hold left / right half', 'Steer with your thumb']);
    else rows.push(['Rotate or tilt phone', 'Steer (touch is the fallback)']);
    rows.push(...(this.cfg.controlsExtra || []));
    rows.push(['Esc', 'Pause']);
    return rows;
  }

  _build() {
    const c = this.cfg;
    // Title
    this.titleInfo = h('p', { class: 'g-record' });
    this.controlsBox = h('ul', { class: 'g-keys' });
    this.tiltBtn = this._btn('Enable Tilt Steering', c.onEnableTilt);
    this.tiltBtn.hidden = true;
    this.screens.title = h('section', { class: 'g-screen g-title', hidden: true },
      h('div', { class: 'g-card' },
        h('p', { class: 'g-eyebrow', text: c.tagline }),
        h('h1', { class: 'g-h1', text: c.title }),
        h('p', { class: 'g-blurb', text: c.blurb || '' }),
        this.titleInfo,
        h('div', { class: 'g-actions' }, this._btn('Play', c.onPlay, true), this._btn('Settings', c.onSettings)),
        h('div', { class: 'g-actions' }, this.tiltBtn),
        this.controlsBox,
        h('a', { class: 'g-link', href: c.backHref, text: '← Back to Arcade' })
      ));
    // Pause
    this.screens.pause = h('section', { class: 'g-screen g-pause-screen', hidden: true, 'aria-label': 'Pause menu' },
      h('div', { class: 'g-card g-pause-card' },
        h('div', { class: 'g-pause-heading' },
          h('h2', { class: 'g-h2', text: 'Paused' }),
          h('button', { class: 'popup-close', type: 'button', 'aria-label': 'Resume game', text: '✕', onclick: c.onResume })),
        h('div', { class: 'g-actions g-actions-col' },
          this._btn('Resume', c.onResume, true), this._btn('Restart', c.onRestart), this._btn('Settings', c.onSettings),
          h('a', { class: 'g-btn', href: c.backHref, text: 'Return to Arcade' })
        )));
    // Game over
    this.overTitle = h('h2', { class: 'g-h2', text: 'Crashed' });
    this.overScore = h('p', { class: 'g-big' });
    this.overLines = h('ul', { class: 'g-stats' });
    this.screens.over = h('section', { class: 'g-screen g-over', hidden: true },
      h('div', { class: 'g-card' },
        this.overTitle, this.overScore, this.overLines,
        h('div', { class: 'g-actions g-actions-col' },
          this._btn('Drive again', c.onRestart, true), this._btn('Settings', c.onSettings),
          h('a', { class: 'g-btn', href: c.backHref, text: 'Return to Arcade' }))));
    Object.values(this.screens).forEach(s => this.layer.append(s));
  }

  _show(name) {
    for (const k in this.screens) this.screens[k].hidden = k !== name;
    this.layer.classList.toggle('on', !!name);
    this.current = name;
    const el = name && this.screens[name];
    if (el) { const b = el.querySelector('.g-btn-primary'); if (b) b.focus({ preventScroll: true }); }
  }

  showTitle(record, showTilt) {
    this.titleInfo.textContent = record || '';
    this.titleInfo.hidden = !record;
    this.tiltBtn.hidden = !showTilt;
    this.controlsBox.replaceChildren(...this.controlsList().map(([k, t]) => h('li', null, h('kbd', { text: k }), h('span', { text: t }))));
    this._show('title');
  }
  showPause() { this._show('pause'); }
  showOver({ title, score, lines, primary }) {
    this.overTitle.textContent = title || 'Crashed';
    this.overScore.textContent = score;
    this.overLines.replaceChildren(...(lines || []).map(l => h('li', { text: l })));
    this.screens.over.querySelector('.g-btn-primary').textContent = primary || 'Drive again';
    this._show('over');
  }
  hide() { this._show(null); }
}
