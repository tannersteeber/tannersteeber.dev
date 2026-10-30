import {
  checked,
  client,
  invoke,
  player,
  rpc,
  scopedKey,
} from '../../../js/arcade-platform/client.js';
const keys = {
  cruise: 'tsd.arcade.settings.v1.cruise',
  cutup: 'tsd.arcade.settings.v1.cutup',
  ripagolf: 'tsd.ripagolf.v1',
};
const canonical = (x) =>
  JSON.stringify(
    x,
    (_, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
        : v,
  );
export class ArcadeServices {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.session = null;
    this.saveRevision = 0;
    this.lastSave = '';
    this.saving = false;
  }
  async init() {
    const user = await player();
    window.ArcadePlayer = { id: user.id };
    const profile = await checked(
      client.from('arcade_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
    );
    if (!profile) throw new Error('Create your player profile in the Arcade first.');
    const save = await checked(
      client.from('arcade_saves').select('*').eq('game_id', this.game).maybeSingle(),
    );
    this.saveRevision = save?.revision || 0;
    const key = scopedKey(keys[this.game]);
    if (save?.payload?.storage) {
      localStorage.setItem(key, save.payload.storage);
      this.lastSave = save.payload.storage;
    }
    this.session = await checked(
      client.from('arcade_sessions').select('*').eq('game_id', this.game).eq('status', 'active')
        .maybeSingle(),
    );
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        this.instance?.pause();
        this.instance?.engine?.stop();
        location.replace(new URL('../../../arcade.html', import.meta.url));
      }
    });
    window.addEventListener('pageshow', async (event) => {
      if (!event.persisted) return;
      try {
        const current = await player();
        if (current.id !== user.id) throw new Error('Account changed');
      } catch {
        this.instance?.engine?.stop();
        location.replace(new URL('../../../arcade.html', import.meta.url));
      }
    });
    this.timer = setInterval(
      () => this.save().catch((e) => this.problem(e, () => this.save())),
      15000,
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save().catch(() => {});
    });
    return this;
  }
  async start(replace = false) {
    const pendingKey = `tsd.arcade.start.${window.ArcadePlayer.id}.${this.game}`;
    let k = localStorage.getItem(pendingKey);
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem(pendingKey, k);
    }
    const s = await rpc('arcade_start', { p_game: this.game, p_key: k, p_replace: replace });
    localStorage.removeItem(pendingKey);
    this.session = s;
    return s;
  }
  async golf(operation, extra = {}) {
    if (!this.session) throw new Error('Start a run first.');
    const storageKey = `tsd.arcade.pending.${window.ArcadePlayer.id}`;
    const request = {
      action: 'golf',
      session: this.session.id,
      revision: this.session.revision,
      operation,
      ...extra,
    };
    let pending;
    try {
      pending = JSON.parse(localStorage.getItem(storageKey));
    } catch {}
    if (pending && canonical(pending.request) !== canonical(request)) {
      throw new Error('A shot is pending. Reload to restore it before continuing.');
    }
    if (!pending) {
      pending = { request, key: crypto.randomUUID() };
      localStorage.setItem(storageKey, JSON.stringify(pending));
    }
    const result = await invoke({ ...pending.request, key: pending.key });
    this.session = { ...this.session, state: result.state, revision: result.revision };
    localStorage.removeItem(storageKey);
    return result.state;
  }
  async restorePending() {
    const k = `tsd.arcade.pending.${window.ArcadePlayer.id}`;
    let pending;
    try {
      pending = JSON.parse(localStorage.getItem(k));
    } catch {}
    if (pending) {
      const result = await invoke({ ...pending.request, key: pending.key });
      if (!this.session) {
        this.session = await checked(
          client.from('arcade_sessions').select('*').eq('id', pending.request.session)
            .maybeSingle(),
        );
      }
      if (
        this.session?.id === pending.request.session && result.revision >= this.session.revision
      ) this.session = { ...this.session, state: result.state, revision: result.revision };
      localStorage.removeItem(k);
    }
  }
  async save() {
    if (this.saving) return;
    const raw = localStorage.getItem(scopedKey(keys[this.game]));
    if (!raw || raw === this.lastSave) return;
    this.saving = true;
    try {
      const result = await rpc('arcade_save', {
        p_game: this.game,
        p_revision: this.saveRevision,
        p_payload: { storage: raw },
      });
      this.saveRevision = result.revision;
      this.lastSave = raw;
    } finally {
      this.saving = false;
    }
  }
  async abandon() {
    if (!this.session) return;
    await rpc('arcade_abandon', { p_session: this.session.id });
    this.session = null;
  }
  async practice(metrics) {
    if (!this.session) return;
    const id = this.session.id;
    await rpc('arcade_practice_finish', { p_session: id, p_metrics: metrics });
    if (this.session?.id === id) this.session = null;
  }
  async retry(task) {
    try {
      return await task();
    } catch (error) {
      return new Promise((resolve) =>
        this.problem(error, async () => resolve(await this.retry(task)))
      );
    }
  }
  problem(error, retry) {
    this.instance?.pause();
    this.instance?.engine?.stop();
    if (this.panel) {
      this.retries.push(retry);
      if (error.code === '40001') this.conflict = true;
      return;
    }
    this.retries = [retry];
    this.conflict = error.code === '40001';
    const panel = this.panel = document.createElement('section');
    panel.className = 'g-platform-error';
    panel.setAttribute('role', 'alert');
    const text = document.createElement('p');
    text.textContent = this.conflict
      ? 'Another device has newer progress. Reload the cloud save to continue.'
      : error.message || 'Connection interrupted. Retry to continue.';
    const b = document.createElement('button');
    b.className = 'g-btn';
    b.textContent = this.conflict ? 'Reload Cloud Save' : 'Retry';
    b.onclick = async () => {
      if (this.conflict) {
        localStorage.removeItem(`tsd.arcade.pending.${window.ArcadePlayer.id}`);
        location.reload();
        return;
      }
      b.disabled = true;
      const jobs = this.retries;
      panel.remove();
      this.panel = null;
      for (const job of jobs) {
        try {
          await job();
        } catch (e) {
          this.problem(e, job);
        }
      }
      if (!this.panel) this.instance?.engine?.start();
    };
    const a = document.createElement('a');
    a.className = 'g-btn';
    a.href = new URL('../../../arcade.html', import.meta.url);
    a.textContent = 'Back to Arcade';
    panel.append(text, b, a);
    this.root.append(panel);
  }
}
export async function requireArcade(game, root) {
  const service = new ArcadeServices(game, root);
  try {
    await service.init();
    await service.restorePending();
    if (game === 'ripagolf') {
      const stats = await checked(
        client.from('arcade_stats').select('stat,value').eq('game_id', game).eq('period_id', 'all')
          .eq('verified', true),
      );
      service.verifiedStats = Object.fromEntries(stats.map((s) => [s.stat, Number(s.value)]));
    }
    return service;
  } catch (error) {
    root.classList.add('ready');
    root.replaceChildren();
    if (error.code === '40001') {
      service.problem(error, () => location.reload());
      root.dataset.accountGate = 'failed';
      return null;
    }
    const p = document.createElement('p');
    p.className = 'g-start-error';
    p.textContent = error.message + ' ';
    const a = document.createElement('a');
    a.href = new URL('../../../arcade.html', import.meta.url);
    a.textContent = 'Sign in at the Arcade';
    p.append(a);
    root.append(p);
    return null;
  }
}
