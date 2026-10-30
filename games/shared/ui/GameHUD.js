/* GameHUD — minimal, readable heads-up display (stats, toasts, flash, pause button, pedals). */
import { h } from './dom.js';
import { gameLogo } from './GameLogo.js?v=20261026-brand-1';

export class GameHUD {
  /** fields: [{ id, label, big? }] */
  constructor(root, fields, hooks) {
    this.el = h('div', { class: 'g-hud', hidden: true });
    this.vals = {};
    const bar = h('div', { class: 'g-hud-bar' });
    fields.forEach((f) => {
      const v = h('span', { class: 'g-hud-val', text: '0' });
      this.vals[f.id] = v;
      bar.append(
        h(
          'div',
          { class: 'g-stat' + (f.big ? ' g-stat-big' : ''), id: 'hud-' + f.id },
          h('span', { class: 'g-hud-label', text: f.label }),
          v,
        ),
      );
    });
    this.timerBar = h('div', { class: 'g-combo-bar', hidden: true }, h('i'));
    this.el.append(bar, this.timerBar);
    this.toastEl = h('div', { class: 'g-toast', 'aria-live': 'polite' });
    this.flashEl = h('div', { class: 'g-flash' });
    this.pauseBtn = h('button', {
      class: 'g-pause-toggle',
      type: 'button',
      'aria-label': 'Pause game',
      'data-ui': '',
      text: 'II',
      onclick: () => hooks.onPause(),
    });
    this.arcadeLink = h('a', {
      class: 'g-arcade-back',
      href: '../../arcade.html',
      'data-ui': '',
      text: '← Arcade',
    });
    this.brand = h(
      'span',
      { class: 'g-small-brand' },
      gameLogo(hooks.id),
      h('span', { text: hooks.title }),
    );
    this.pedals = h(
      'div',
      { class: 'g-pedals', 'data-ui': '', hidden: true },
      this._pedal('Brake', -1, hooks),
      this._pedal('Gas', 1, hooks),
    );
    this.hooks = hooks;
    root.append(
      this.el,
      this.toastEl,
      this.flashEl,
      this.pauseBtn,
      this.arcadeLink,
      this.brand,
      this.pedals,
    );
  }

  _pedal(label, dir, hooks) {
    const b = h('button', { class: 'g-pedal', type: 'button', text: label, 'aria-label': label });
    const on = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hooks.onPedal(dir);
      b.classList.add('down');
    };
    const off = () => {
      hooks.onPedal(0);
      b.classList.remove('down');
    };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    return b;
  }

  show(on) {
    this.el.hidden = !on;
    this.pauseBtn.hidden = false;
    if (!on) this.pedals.hidden = true;
  }
  set(id, text) {
    const v = this.vals[id];
    if (v && v.textContent !== text) v.textContent = text;
  }
  showPedals(on) {
    this.pedals.hidden = !on;
  }

  bar(frac) {
    this.timerBar.hidden = frac <= 0;
    this.timerBar.firstChild.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac)) + ')';
  }

  toast(text, kind) {
    const t = this.toastEl;
    t.textContent = text;
    t.dataset.kind = kind || '';
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), 900);
  }

  flash() {
    const f = this.flashEl;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }
}
