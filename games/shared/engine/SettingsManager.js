/* SettingsManager — versioned localStorage settings + personal records for the arcade games.
 * Only values that differ from the defaults are stored. Site theme keys are shared with js/main.js. */

const storageKey = () =>
  globalThis.window?.ArcadePlayer?.id
    ? 'tsd.arcade.settings.v1.' + (document.body.dataset.game || 'driving') + '.' +
      window.ArcadePlayer.id
    : 'tsd.arcade.settings.v1';
const SCHEMA = 1;
const CHOICES = {
  desktopMode: ['keyboard', 'mouse'],
  mobileMode: ['touch', 'tilt'],
  graphics: ['low', 'medium', 'high'],
  'cruise.camera': ['close', 'far', 'hood', 'first'],
  'cutup.camera': ['close', 'far', 'hood', 'first'],
  'cruise.timeOfDay': ['auto', 'day', 'sunset', 'night'],
  'cutup.timeOfDay': ['auto', 'day', 'sunset', 'night'],
  'cruise.weather': ['clear', 'fog', 'rain'],
  'cutup.weather': ['clear', 'fog', 'rain'],
  'cutup.traffic': ['low', 'medium', 'high', 'extreme'],
};
const RANGES = {
  sensitivity: [0.4, 2],
  tiltDeadzone: [0, 12],
  tiltRange: [12, 60],
  volume: [0, 1],
  'cruise.speed': [8, 40],
};
function valid(key, value, defaults) {
  if (!Object.hasOwn(defaults, key) || typeof value !== typeof defaults[key]) return false;
  if (key === 'carColor') return /^#[0-9a-f]{6}$/i.test(value);
  if (CHOICES[key]) return CHOICES[key].includes(value);
  if (RANGES[key]) {
    return Number.isFinite(value) && value >= RANGES[key][0] && value <= RANGES[key][1];
  }
  return true;
}

export function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches ||
      (navigator.maxTouchPoints > 0 && !window.matchMedia('(hover: hover)').matches);
  } catch (e) {
    return false;
  }
}

function defaults() {
  return {
    desktopMode: 'keyboard', // keyboard | mouse
    mobileMode: 'touch', // touch | tilt
    sensitivity: 1,
    carColor: '#1f6feb',
    invert: false,
    tiltDeadzone: 3, // degrees
    tiltRange: 30, // degrees for full lock
    graphics: isTouchDevice() ? 'medium' : 'high',
    volume: 0.6,
    muted: false,
    'cruise.camera': 'close',
    'cruise.autoSpeed': true,
    'cruise.speed': 22, // m/s target when auto speed is on
    'cruise.assist': false,
    'cruise.timeOfDay': 'auto',
    'cruise.weather': 'clear',
    'cutup.camera': 'far',
    'cutup.traffic': 'medium',
    'cutup.timeOfDay': 'auto',
    'cutup.weather': 'clear',
  };
}

export class SettingsManager {
  constructor() {
    this.defaults = defaults();
    this.data = defaults();
    this.records = {};
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const o = JSON.parse(raw);
      if (!o || o.v !== SCHEMA) return; // future migrations hook in here
      for (const k of Object.keys(o.data || {})) {
        if (valid(k, o.data[k], this.defaults)) this.data[k] = o.data[k];
      }
      for (const k of ['cutup.best', 'cruise.distance']) {
        if (Number.isFinite(o.records?.[k]) && o.records[k] >= 0) this.records[k] = o.records[k];
      }
    } catch (e) { /* ignore corrupt storage */ }
  }

  _save() {
    try {
      const diff = {};
      for (const k of Object.keys(this.data)) {
        if (this.data[k] !== this.defaults[k]) diff[k] = this.data[k];
      }
      localStorage.setItem(
        storageKey(),
        JSON.stringify({ v: SCHEMA, data: diff, records: this.records }),
      );
    } catch (e) { /* storage unavailable (private mode) */ }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    if (!valid(key, value, this.defaults)) return;
    if (this.data[key] === value) return;
    this.data[key] = value;
    this._save();
    this.listeners.forEach((cb) => cb(key, value));
  }

  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Active steering mode for this device. */
  controlMode() {
    return isTouchDevice() ? this.data.mobileMode : this.data.desktopMode;
  }

  record(key) {
    return this.records[key] || 0;
  }

  /** Stores value if it beats the current record. Returns true on a new record. */
  submitRecord(key, value) {
    if (
      !['cutup.best', 'cruise.distance'].includes(key) || !Number.isFinite(value) ||
      !(value > (this.records[key] || 0))
    ) return false;
    this.records[key] = value;
    this._save();
    return true;
  }
}

/* ---------- Site theme bridge (shares keys with js/main.js) ---------- */
const root = document.documentElement;
export const PAGE_THEMES = [
  { id: 'signature', label: 'Signature' },
  { id: 'retro', label: 'Retro' },
  { id: 'rain', label: 'Digital Rain' },
];

export const SiteTheme = {
  apply() {
    let site = null, page = null, hue = null;
    try {
      site = localStorage.getItem('site-theme');
      page = localStorage.getItem('page-theme');
      hue = localStorage.getItem('rain-hue');
    } catch (e) { /* ignore */ }
    if (!site) {
      site = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    root.classList.toggle('theme-dark', site === 'dark');
    if (page && page !== 'signature' && PAGE_THEMES.some((t) => t.id === page)) {
      root.setAttribute('data-page-theme', page);
    } else root.removeAttribute('data-page-theme');
    if (hue) root.style.setProperty('--rain-h', hue);
  },
  pageTheme() {
    return root.getAttribute('data-page-theme') || 'signature';
  },
  isDark() {
    return root.classList.contains('theme-dark') || !!root.getAttribute('data-page-theme');
  },
  setPageTheme(id) {
    try {
      localStorage.setItem('page-theme', id);
    } catch (e) { /* ignore */ }
    SiteTheme.apply();
  },
  setAppearance(mode) {
    try {
      localStorage.setItem('site-theme', mode);
    } catch (e) { /* ignore */ }
    SiteTheme.apply();
  },
  appearance() {
    return root.classList.contains('theme-dark') ? 'dark' : 'light';
  },
  rainHue() {
    const hue = parseFloat(getComputedStyle(root).getPropertyValue('--rain-h'));
    return Number.isFinite(hue) ? Math.max(0, Math.min(360, hue)) : 144;
  },
};
