import { MILESTONES, predictionWon, reward, scoreName } from './rules.js?v=20261026-touch-9';
const storageKey = () =>
  globalThis.window?.ArcadePlayer?.id
    ? 'tsd.ripagolf.v1.' + window.ArcadePlayer.id
    : 'tsd.ripagolf.v1';
const DEFAULTS = {
  graphics: 'medium',
  swingSensitivity: 1,
  cameraSensitivity: 1,
  effects: .65,
  music: .12,
  muted: false,
  reducedMotion: false,
  puttingGuide: true,
  greenHeightmap: false,
};
const STATS = {
  bestStreak: 0,
  highestScore: 0,
  lifetimePoints: 0,
  holes: 0,
  strokes: 0,
  birdies: 0,
  eagles: 0,
  aces: 0,
  won: 0,
  lost: 0,
  relativeTotal: 0,
  achievements: [],
};
export class GolfStore {
  constructor() {
    this.settings = {
      ...DEFAULTS,
      reducedMotion: typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
    this.stats = { ...STATS, achievements: [] };
    this.run = null;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()));
      if (saved?.v === 1) {
        for (const [k, v] of Object.entries(saved.settings || {})) this.set(k, v, false);
        for (const k of Object.keys(STATS)) {
          if (
            k !== 'achievements' && Number.isFinite(saved.stats?.[k]) && saved.stats[k] >= -1000000
          ) this.stats[k] = saved.stats[k];
        }
        this.stats.achievements = (saved.stats?.achievements || []).filter((v) =>
          Object.values(MILESTONES).includes(v)
        );
        if (
          saved.run && Number.isInteger(saved.run.seed) && Number.isInteger(saved.run.holeIndex) &&
          saved.run.holeIndex >= 1 && saved.run.holeIndex < 100000 &&
          ['active', 'lost', 'abandoned'].includes(saved.run.status) &&
          Number.isFinite(saved.run.score) && Number.isFinite(saved.run.streak)
        ) this.run = saved.run;
      }
    } catch {}
  }
  set(key, value, save = true) {
    if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key]) return;
    if (key === 'graphics' && !['low', 'medium', 'high'].includes(value)) return;
    if (typeof value === 'number') {
      const range = key.includes('Sensitivity') ? [.4, 2] : [0, 1];
      if (!Number.isFinite(value) || value < range[0] || value > range[1]) return;
    }
    this.settings[key] = value;
    if (save) this.save();
  }
  save() {
    try {
      localStorage.setItem(
        storageKey(),
        JSON.stringify({ v: 1, settings: this.settings, stats: this.stats, run: this.run }),
      );
    } catch {}
  }
  start(seed) {
    this.run = {
      seed: seed >>> 0,
      holeIndex: 1,
      streak: 0,
      score: 0,
      status: 'active',
      hole: null,
    };
    this.save();
    return this.run;
  }
  stroke(count = 1) {
    this.stats.strokes += count;
    this.save();
  }
  settle(hole) {
    if (hole.result) return hole.result;
    const run = this.run,
      won = predictionWon(hole.prediction, hole.par, hole.strokes),
      oldStreak = run.streak;
    run.streak = won ? run.streak + 1 : 0;
    const points = won ? reward(hole.prediction, run.streak) : 0;
    run.score += points;
    run.status = won ? 'active' : 'lost';
    const stats = this.stats;
    stats.holes++;
    stats.relativeTotal += hole.strokes - hole.par;
    stats[won ? 'won' : 'lost']++;
    stats.lifetimePoints += points;
    if (hole.strokes === 1) stats.aces++;
    if (hole.strokes - hole.par === -1) stats.birdies++;
    if (hole.strokes - hole.par === -2) stats.eagles++;
    stats.bestStreak = Math.max(stats.bestStreak, run.streak);
    stats.highestScore = Math.max(stats.highestScore, run.score);
    const milestone = won ? MILESTONES[run.streak] : null;
    if (milestone && !stats.achievements.includes(milestone)) stats.achievements.push(milestone);
    hole.result = {
      won,
      points,
      streak: run.streak,
      oldStreak,
      score: run.score,
      name: scoreName(hole.par, hole.strokes),
      milestone,
    };
    this.save();
    return hole.result;
  }
}
