/* SettingsPanel — modal with every setting backed by SettingsManager (no placeholder controls). */
import { h } from './dom.js';
import { isTouchDevice, PAGE_THEMES, SiteTheme } from '../engine/SettingsManager.js';

export class SettingsPanel {
  /**
   * @param root       game root element
   * @param settings   SettingsManager
   * @param input      InputManager (for the tilt sensor)
   * @param gameFields extra game-specific field specs
   * @param hooks      { onTheme(), onClose(), onSound() }
   */
  constructor(root, settings, input, gameFields, hooks) {
    this.settings = settings; this.input = input; this.hooks = hooks || {};
    this.touch = isTouchDevice();
    this.rows = [];
    this.el = h('div', { class: 'g-panel', 'data-ui': '', role: 'dialog', 'aria-label': 'Settings', hidden: true });
    const inner = h('div', { class: 'g-card g-panel-inner' });
    inner.append(h('h2', { class: 'g-h2', text: 'Settings' }));
    const body = h('div', { class: 'g-panel-body' });
    inner.append(body);
    const close = h('button', { class: 'g-btn g-btn-primary', type: 'button', text: 'Done', onclick: () => this.close() });
    inner.append(h('div', { class: 'g-actions' }, close));
    this.el.append(inner);
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    root.append(this.el);
    this._build(body, gameFields || []);
    this.refresh();
    this._off = this.settings.onChange(() => this.refresh());
    input.tilt.onStatus = () => this.refresh();
    this._key = (e) => {
      if (e.code === 'Tab' && !this.el.hidden) {
        const all = [this.el.parentElement.querySelector('.g-arcade-back'),...this.el.querySelectorAll('button, select, input, a')].filter(Boolean).filter(el => !el.disabled && el.getClientRects().length);
        const first = all[0], last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.code === 'Escape' && !this.el.hidden) { e.stopImmediatePropagation(); this.close(); } };
    window.addEventListener('keydown', this._key, true);
  }

  _section(body, title) { body.append(h('h3', { class: 'g-h3', text: title })); }

  _field(body, f) {
    const s = this.settings;
    let control, valueEl = null;
    const get = () => (f.get ? f.get() : s.get(f.key));
    const set = (v) => { f.set ? f.set(v) : s.set(f.key, v); if (f.after) f.after(v); };
    if (f.type === 'select') {
      control = h('select', { class: 'g-input', 'aria-label': f.label, onchange: (e) => {
        const raw = e.target.value, orig = f.options.find(o => String(o[0]) === raw);
        set(orig ? orig[0] : raw);
      } }, f.options.map(o => h('option', { value: String(o[0]), text: o[1] })));
    } else if (f.type === 'range') {
      valueEl = h('span', { class: 'g-val' });
      control = h('input', { class: 'g-range', type: 'range', min: f.min, max: f.max, step: f.step, 'aria-label': f.label, oninput: (e) => { set(parseFloat(e.target.value)); } });
    } else if (f.type === 'color') {
      control = h('input', { class: 'g-color', type: 'color', 'aria-label': f.label, oninput: e => set(e.target.value) });
    } else if (f.type === 'check') {
      control = h('input', { class: 'g-check', type: 'checkbox', 'aria-label': f.label, onchange: (e) => set(e.target.checked) });
    }
    const row = h('label', { class: 'g-row' }, h('span', { class: 'g-label', text: f.label }), h('span', { class: 'g-ctl' }, control, valueEl));
    body.append(row);
    if (f.hint) body.append(h('p', { class: 'g-hint', text: f.hint }));
    this.rows.push({ f, row, control, valueEl, get });
  }

  _build(body, gameFields) {
    const s = this.settings;
    this._section(body, 'Controls');
    if (this.touch) {
      this._field(body, { type: 'select', key: 'mobileMode', label: 'Steering', options: [['touch', 'Touch (hold left / right)'], ['tilt', 'Tilt / rotate phone']] });
    } else {
      this._field(body, { type: 'select', key: 'desktopMode', label: 'Steering', options: [['keyboard', 'Keyboard (A/D, ←/→)'], ['mouse', 'Mouse (hold left / right half)']] });
    }
    this._field(body, { type: 'range', key: 'sensitivity', label: 'Sensitivity', min: 0.4, max: 2, step: 0.05, format: v => v.toFixed(2) + '×' });
    this._field(body, { type: 'check', key: 'invert', label: 'Invert steering' });

    // Tilt block (touch devices, tilt mode only)
    this.tiltBox = h('div', { class: 'g-tilt' });
    this.tiltStatus = h('p', { class: 'g-hint g-tilt-status' });
    this.tiltEnable = h('button', { class: 'g-btn g-btn-primary', type: 'button', text: 'Enable Tilt Steering', onclick: async () => {
      await this.input.tilt.enable(); this.refresh();
    } });
    this.tiltCal = h('button', { class: 'g-btn', type: 'button', text: 'Calibrate neutral', onclick: () => { this.input.tilt.calibrate(); this.refresh(); } });
    this.tiltBox.append(this.tiltStatus, h('div', { class: 'g-actions g-actions-left' }, this.tiltEnable, this.tiltCal));
    body.append(this.tiltBox);
    this._field(body, { type: 'range', key: 'tiltDeadzone', label: 'Tilt dead zone', min: 0, max: 12, step: 0.5, format: v => v.toFixed(1) + '°', tilt: true });
    this._field(body, { type: 'range', key: 'tiltRange', label: 'Tilt for full lock', min: 12, max: 60, step: 1, format: v => Math.round(v) + '°', tilt: true });
    this.tiltBox.append(h('p', { class: 'g-hint', text: 'Hold the phone like a wheel, or lay it flat and rotate it. Neutral is captured when you press Calibrate, start a drive, or rotate the screen.' }));

    if (gameFields.length) { this._section(body, 'Game'); gameFields.forEach(f => this._field(body, f)); }

    this._section(body, 'Graphics');
    this._field(body, { type: 'select', key: 'graphics', label: 'Quality', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], hint: 'Resolution and view distance apply instantly; anti-aliasing (High) applies after a reload.' });

    this._section(body, 'Audio');
    this._field(body, { type: 'range', key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05, format: v => Math.round(v * 100) + '%' });
    this._field(body, { type: 'check', key: 'muted', label: 'Mute' });

    this._section(body, 'Appearance');
    this._field(body, { type: 'color', key: 'carColor', label: 'Car color', show: () => SiteTheme.pageTheme() === 'signature' });
    this._field(body, {
      type: 'select', label: 'Page theme', options: PAGE_THEMES.map(t => [t.id, t.label]),
      get: () => SiteTheme.pageTheme(), set: (v) => { SiteTheme.setPageTheme(v); }, after: () => { this.hooks.onTheme && this.hooks.onTheme(); this.refresh(); }
    });
    this._field(body, {
      type: 'range', label: 'Rain hue', min: 0, max: 360, step: 1, format: v => Math.round(v) + '°',
      show: () => SiteTheme.pageTheme() === 'rain', get: () => SiteTheme.rainHue(),
      set: (v) => { document.documentElement.style.setProperty('--rain-h', String(v)); try { localStorage.setItem('rain-hue', String(v)); } catch {} },
      after: () => { this.hooks.onTheme && this.hooks.onTheme(); this.refresh(); }
    });
    this._field(body, {
      type: 'select', label: 'Light / dark', options: [['light', 'Light'], ['dark', 'Dark']], appearance: true,
      get: () => SiteTheme.appearance(), set: (v) => { SiteTheme.setAppearance(v); }, after: () => { this.hooks.onTheme && this.hooks.onTheme(); this.refresh(); }
    });
  }

  refresh() {
    const s = this.settings, tilt = this.input.tilt;
    const tiltMode = this.touch && s.get('mobileMode') === 'tilt';
    for (const r of this.rows) {
      const v = r.get();
      if (r.f.type === 'check') r.control.checked = !!v;
      else if (r.f.type === 'range') { r.control.value = v; if (r.valueEl) r.valueEl.textContent = r.f.format ? r.f.format(v) : String(v); }
      else if (document.activeElement !== r.control) r.control.value = String(v);
      let show = r.f.show ? r.f.show() : true;
      if (r.f.tilt) show = tiltMode;
      if (r.f.appearance) show = SiteTheme.pageTheme() === 'signature';
      r.row.hidden = !show;
      if (r.row.nextElementSibling && r.row.nextElementSibling.classList.contains('g-hint') && r.f.hint) r.row.nextElementSibling.hidden = !show;
    }
    this.tiltBox.hidden = !tiltMode;
    if (tiltMode) {
      this.tiltStatus.textContent = tilt.message;
      this.tiltEnable.hidden = tilt.active || tilt.status === 'unavailable';
      this.tiltEnable.disabled = tilt.status === 'requesting';
      this.tiltCal.hidden = !tilt.active;
    }
  }

  open() {
    this._previousFocus = document.activeElement;
    this.refresh(); this.el.hidden = false;
    for (const el of this.el.parentElement.children) if (el !== this.el && !el.matches('.g-arcade-back')) el.inert = true;
    this.el.querySelector('select, button').focus();
  }
  close() { if (this.el.hidden) return; this.el.hidden = true; for (const el of this.el.parentElement.children) el.inert = false; this._previousFocus?.focus({ preventScroll: true }); this.hooks.onClose && this.hooks.onClose(); }
  get isOpen() { return !this.el.hidden; }
  destroy() { this._off(); this.input.tilt.onStatus = null; window.removeEventListener('keydown', this._key, true); this.el.remove(); }
}
