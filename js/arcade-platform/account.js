import { captcha } from './captcha.js?v=2';
import { callbackUrl, checked, client, invoke, player, rpc } from './client.js';
const host = document.getElementById('arcade-account'),
  library = document.getElementById('arcade-library');
let user,
  profile,
  mode = 'signin',
  view = 'Library',
  generation = 0,
  recovery = new URLSearchParams(location.search).get('recovery') === '1';
const names = { cruise: 'Cruise', cutup: 'Cutup', ripagolf: 'RipaGolf', arcade: 'Arcade' };
function el(tag, text, attrs = {}) {
  const n = document.createElement(tag);
  if (text !== null) n.textContent = text;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
function button(text, fn, parent, attrs = {}) {
  const b = el('button', text, { type: 'button', class: 'btn', ...attrs });
  b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      status(e.message, true);
    } finally {
      b.disabled = false;
    }
  });
  parent.append(b);
  return b;
}
function clearHost() {
  for (const f of host.querySelectorAll('form')) f.challenge?.destroy?.();
  host.replaceChildren();
}
function status(message, error = false, target = host) {
  let n = document.getElementById('ap-status');
  if (!n) {
    n = el('p', null, {
      id: 'ap-status',
      class: 'ap-status',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
  }
  if (target.tagName === 'FORM') target.insertBefore(n, target.querySelector('[type=submit]'));
  else if (!n.isConnected) target.prepend(n);
  n.textContent = message;
  n.dataset.error = String(error);
}
let fieldId = 0;
function field(form, label, name, type = 'text', value = '') {
  const group = el('div', null, { class: 'ap-field' }),
    id = `ap-field-${++fieldId}`,
    l = el('label', label, { for: id }),
    i = el('input', null, { id, name, type });
  i.value = value;
  i.required = true;
  group.append(l);
  if (type === 'password') {
    i.minLength = 12;
    i.autocomplete = name === 'current' || (mode === 'signin' && name === 'password' && !recovery)
      ? 'current-password'
      : 'new-password';
    const row = el('div', null, { class: 'ap-input-row' });
    row.append(i);
    button(
      'Show',
      () => {
        const show = i.type === 'password';
        i.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Hide' : 'Show';
        toggle.setAttribute('aria-pressed', String(show));
        toggle.setAttribute(
          'aria-label',
          `${show ? 'Hide' : 'Show'} ${name === 'current' ? 'current password' : 'password'}`,
        );
      },
      row,
      {
        class: 'ap-password-toggle',
        'aria-label': name === 'current' ? 'Show current password' : 'Show password',
        'aria-pressed': 'false',
        'aria-controls': id,
      },
    );
    const toggle = row.querySelector('button');
    group.append(row);
  } else group.append(i);
  if (type === 'email') {
    i.autocomplete = 'email';
    i.spellcheck = false;
    i.autocapitalize = 'none';
  }
  form.append(group);
  return i;
}
function check(form, text, value) {
  const l = el('label', text, { class: 'ap-check' }), i = el('input', null, { type: 'checkbox' });
  i.checked = value;
  l.prepend(i);
  form.append(l);
  return i;
}
function form(parent, fn) {
  const f = el('form', null, { class: 'ap-form' });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.getAttribute('aria-busy') === 'true') return;
    const b = f.querySelector('[type=submit]'), text = b.textContent;
    b.disabled = true;
    b.textContent = 'Please wait…';
    f.setAttribute('aria-busy', 'true');
    status('Working…', false, f);
    try {
      await fn(f);
    } catch (err) {
      status(err.message, true, f);
    } finally {
      f.challenge?.reset();
      b.disabled = false;
      b.textContent = text;
      f.removeAttribute('aria-busy');
    }
  });
  parent.append(f);
  return f;
}
const submit = (f, text) =>
  f.append(el('button', text, { class: 'btn btn-primary', type: 'submit' }));
function card(title, parent = host) {
  const c = el('section', null, { class: 'ap-card' });
  c.append(el('h2', title));
  parent.append(c);
  return c;
}
function verificationPrompt(email) {
  clearHost();
  library.hidden = true;
  const c = card('Check your email');
  c.classList.add('ap-confirmation');
  const heading = c.querySelector('h2');
  c.append(
    el(
      'p',
      `Check ${email} for a verification link. Open the link to verify your account, then sign in to play.`,
    ),
  );
  c.append(
    el(
      'p',
      'If you don’t see the email, check your spam or junk folder. You can resend the verification email from Sign In.',
      { class: 'ap-note' },
    ),
  );
  button('Back to Sign In', () => {
    mode = 'signin';
    auth(email);
  }, c);
  heading.tabIndex = -1;
  heading.focus();
}
function auth(prefillEmail = '') {
  clearHost();
  library.hidden = true;
  const c = card('Welcome to the Arcade');
  c.classList.add('ap-auth');
  const intro = el('div', null, { class: 'ap-auth-intro' });
  intro.append(...c.childNodes);
  c.append(intro);
  intro.prepend(el('p', 'Your player account', { class: 'ap-eyebrow' }));
  intro.append(
    el('p', 'Sign in to play, keep your progress across devices, and manage your player profile.'),
  );
  const benefits = el('ul', null, { class: 'ap-benefits' });
  for (
    const text of [
      'One account for every game',
      'Your progress, across devices',
      'You choose what your profile shares',
    ]
  ) benefits.append(el('li', text));
  intro.append(benefits);
  const pane = el('div', null, { class: 'ap-auth-fields' });
  c.append(pane);
  const tabs = el('div', null, {
    class: 'ap-actions ap-auth-tabs',
    role: 'group',
    'aria-label': 'Account access',
  });
  pane.append(tabs);
  for (
    const [m, label] of [['signin', 'Sign In'], ['signup', 'Create Account'], [
      'reset',
      'Forgot Password',
    ]]
  ) {
    button(
      label,
      () => {
        const email = f.elements.email.value;
        mode = m;
        auth(email);
        host.querySelector('.ap-auth-tabs [aria-pressed=true]').focus();
      },
      tabs,
      { 'aria-pressed': mode === m },
    );
  }
  const descriptions = {
    signin: ['Welcome back', 'Sign in with your verified email to open the game library.'],
    signup: [
      'Create your account',
      'Use an email you can access. We’ll send you a link to verify your account.',
    ],
    reset: ['Reset your password', 'Enter your account email and we’ll send you a recovery link.'],
  };
  pane.append(
    el('h3', descriptions[mode][0]),
    el('p', descriptions[mode][1], { class: 'ap-note' }),
  );
  const f = form(pane, async (f) => {
    const email = f.elements.email.value.trim(), captchaToken = challenge.token();
    if (mode === 'reset') {
      await checked(
        client.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl() + '?recovery=1',
          captchaToken,
        }),
      );
      status('If this address can receive a recovery email, a link is on its way.', false, f);
    } else if (mode === 'signup') {
      const data = await checked(
        client.auth.signUp({
          email,
          password: f.elements.password.value,
          options: { emailRedirectTo: callbackUrl(), captchaToken },
        }),
      );
      if (data.session) await refresh();
      else verificationPrompt(email);
    } else {
      await checked(
        client.auth.signInWithPassword({
          email,
          password: f.elements.password.value,
          options: { captchaToken },
        }),
      );
      await refresh();
    }
  });
  field(f, 'Email', 'email', 'email', prefillEmail);
  if (mode !== 'reset') field(f, 'Password (at least 12 characters)', 'password', 'password');
  const challenge = captcha(f);
  f.challenge = challenge;
  submit(
    f,
    mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Recovery Email',
  );
  if (mode === 'signin') {
    button(
      'Resend verification email',
      async () => {
        const email = f.elements.email.value.trim();
        if (!email || !f.elements.email.reportValidity()) {
          throw new Error('Enter your email first.');
        }
        try {
          await checked(
            client.auth.resend({
              type: 'signup',
              email,
              options: { emailRedirectTo: callbackUrl(), captchaToken: challenge.token() },
            }),
          );
          status('Check your email for a verification link.', false, f);
        } finally {
          challenge.reset();
        }
      },
      pane,
      { class: 'btn ap-text-button' },
    );
  }
}

function profileForm(parent, initial = false) {
  const f = form(parent, async () => {
    profile = await rpc('arcade_profile_save', {
      p_username: username.value.trim(),
      p_public: pub.checked,
      p_ranked: ranked.checked,
      p_display_name: display.value.trim(),
    });
    await refresh();
    status('Profile saved.');
  });
  const username = field(f, 'Username', 'username', 'text', profile?.username || '');
  username.pattern = '[A-Za-z0-9_]{3,24}';
  username.minLength = 3;
  username.maxLength = 24;
  username.autocomplete = 'username';
  username.insertAdjacentElement(
    'afterend',
    el('span', '3–24 letters, numbers, or underscores.', { class: 'ap-field-hint' }),
  );
  const display = field(
    f,
    'Display name (optional)',
    'display_name',
    'text',
    profile?.display_name || '',
  );
  display.required = false;
  display.maxLength = 40;
  const pub = check(
      f,
      'Allow signed-in players to view my verified profile',
      profile?.public_profile || false,
    ),
    ranked = check(f, 'Participate in verified leaderboards', profile?.leaderboard_opt_in || false);
  submit(f, initial ? 'Create Player Profile' : 'Save Profile');
}
async function refresh() {
  const current = ++generation;
  try {
    user = await player();
    const p = await checked(
      client.from('arcade_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    );
    if (current !== generation) return;
    profile = p;
    window.ArcadePlayer = { id: user.id };
    render();
  } catch (e) {
    if (current !== generation) return;
    if (/sign in|session|jwt|auth|verified/i.test(e.message)) {
      user = null;
      window.ArcadePlayer = null;
      auth();
    } else {
      clearHost();
      library.hidden = true;
      card('Arcade connection').append(
        el('p', 'The Arcade backend is not ready or could not be reached.'),
      );
      status(e.message, true);
      button('Try Again', refresh, host);
    }
  }
}
function render() {
  clearHost();
  library.hidden = true;
  if (recovery) {
    const c = card('Choose a new password');
    c.classList.add('ap-confirmation');
    c.append(
      el('p', 'Choose a password with at least 12 characters to secure your account.', {
        class: 'ap-note',
      }),
    );
    const f = form(c, async () => {
      await checked(client.auth.updateUser({ password: f.elements.password.value }));
      recovery = false;
      history.replaceState(null, '', location.pathname);
      await refresh();
      status('Password updated.');
    });
    field(f, 'New password', 'password', 'password');
    submit(f, 'Update Password');
    return;
  }
  if (!profile) {
    const setup = card('Choose your player name');
    setup.classList.add('ap-confirmation');
    setup.append(
      el(
        'p',
        'Choose how you appear in the Arcade. Your profile and rankings are private unless you opt in.',
        { class: 'ap-note' },
      ),
    );
    profileForm(setup, true);
    button('Sign Out', () => checked(client.auth.signOut()), host);
    return;
  }
  const top = el('div', null, { class: 'ap-topline' });
  top.append(el('p', `Playing as ${profile.username}`));
  button('Sign Out', async () => {
    await checked(client.auth.signOut());
    auth();
  }, top);
  host.append(top);
  const nav = el('nav', null, { class: 'ap-nav', 'aria-label': 'Arcade account' });
  host.append(nav);
  for (
    const label of [
      'Library',
      'Profile',
      'Statistics',
      'Leaderboards',
      'Wallet',
      'Achievements',
      'Settings',
    ]
  ) {
    button(
      label,
      () => {
        view = label;
        render();
      },
      nav,
      { 'aria-pressed': label === view },
    );
  }
  status('');
  if (view === 'Library') {
    library.hidden = false;
    return;
  }
  const panel = card(view);
  panel.setAttribute('aria-busy', 'true');
  const loading = el('p', 'Loading…', { class: 'ap-loading', role: 'status' });
  panel.append(loading);
  loadView(panel).catch((e) => {
    if (panel.isConnected) status(e.message, true);
  }).finally(() => {
    loading.remove();
    panel.removeAttribute('aria-busy');
  });
}
async function loadView(panel) {
  if (view === 'Profile') {
    const [w, stats, ach] = await Promise.all([
      checked(client.from('arcade_wallets').select('*').single()),
      checked(client.from('arcade_stats').select('*').eq('period_id', 'all')),
      checked(client.from('arcade_achievements').select('*')),
    ]);
    panel.append(
      el(
        'p',
        `${profile.display_name ? profile.display_name + ' · ' : ''}${profile.username} · Joined ${
          new Date(profile.created_at).toLocaleDateString()
        }`,
      ),
    );
    metrics(panel, [
      ['Arcade Points', w.arcade_points],
      ['Lifetime earned', w.lifetime_earned],
      ['Casino chips', w.casino_chips],
      [
        'Game sessions',
        stats.find((s) => s.game_id === 'arcade' && s.stat === 'runs_started')?.value || 0,
      ],
      ['Achievements', ach.length],
      [
        'Verified holes',
        stats.find((s) => s.game_id === 'ripagolf' && s.stat === 'holes' && s.verified)?.value || 0,
      ],
    ]);
    panel.append(
      el(
        'p',
        'Your wallet and practice records are private. Public profiles include verified statistics only.',
        { class: 'ap-note' },
      ),
    );
  }
  if (view === 'Statistics') await statistics(panel);
  if (view === 'Achievements') {
    const [defs, unlocked, stats] = await Promise.all([
      checked(client.from('arcade_achievement_definitions').select('*')),
      checked(client.from('arcade_achievements').select('*')),
      checked(client.from('arcade_stats').select('*').eq('period_id', 'all').eq('verified', true)),
    ]);
    panel.append(
      el('p', 'Achievements track server-verified play. Practice records do not count.', {
        class: 'ap-note',
      }),
    );
    if (!defs.length) {
      panel.append(
        el('p', 'No achievements available yet. Check back as the Arcade grows.', {
          class: 'ap-empty',
        }),
      );
    }
    const grid = el('div', null, { class: 'ap-achievements' });
    panel.append(grid);
    for (const d of defs) {
      const a = unlocked.find((a) => a.achievement_id === d.id),
        value = Math.min(
          d.threshold,
          Number(stats.find((s) => s.game_id === d.game_id && s.stat === d.stat)?.value || 0),
        ),
        item = el('article', null, { class: 'ap-achievement' });
      item.append(
        el('h3', d.name),
        el('p', d.description, { class: 'ap-note' }),
        el(
          'p',
          a
            ? 'Unlocked · ' + new Date(a.unlocked_at).toLocaleDateString()
            : format(value) + ' / ' + format(d.threshold),
          { class: 'ap-achievement-state' },
        ),
      );
      item.append(
        el('progress', null, {
          max: d.threshold,
          value: a ? d.threshold : value,
          'aria-label': d.name + ' progress',
        }),
      );
      grid.append(item);
    }
  }
  if (view === 'Settings') {
    const grid = el('div', null, { class: 'ap-settings-grid' }),
      identity = el('section', null, { class: 'ap-settings-section' }),
      security = el('section', null, { class: 'ap-settings-section' });
    panel.append(grid);
    grid.append(identity, security);
    identity.append(el('h3', 'Player profile'));
    profileForm(identity);
    security.append(el('h3', 'Password & security'));
    const pw = form(security, async () => {
      await checked(
        client.auth.updateUser({
          password: pw.elements.password.value,
          currentPassword: pw.elements.current.value,
        }),
      );
      status('Password changed.');
      pw.reset();
    });
    field(pw, 'Current password', 'current', 'password');
    field(pw, 'New password', 'password', 'password').autocomplete = 'new-password';
    submit(pw, 'Change Password');
    button('Sign Out All Devices', async () => {
      await checked(client.auth.signOut({ scope: 'global' }));
      auth();
    }, security);
    const danger = card('Delete account', panel);
    danger.classList.add('ap-danger');
    danger.append(
      el(
        'p',
        'Permanently remove your profile, cloud saves, statistics, and virtual balances. Enter your password and type DELETE to confirm.',
      ),
    );
    const df = form(danger, async () => {
      if (df.elements.confirm.value !== 'DELETE') throw new Error('Type DELETE to confirm.');
      await checked(
        client.auth.signInWithPassword({
          email: user.email,
          password: df.elements.password.value,
          options: { captchaToken: deletionChallenge.token() },
        }),
      );
      await invoke({ action: 'delete-account' });
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('tsd.') && key.includes(user.id)) localStorage.removeItem(key);
      }
      await client.auth.signOut({ scope: 'local' });
      auth();
      status('Your account has been deleted.');
    });
    const deletionChallenge = captcha(df);
    df.challenge = deletionChallenge;
    field(df, 'Password', 'password', 'password');
    field(df, 'Type DELETE', 'confirm');
    submit(df, 'Permanently Delete Account');
  }
  if (view === 'Wallet') await wallet(panel);
  if (view === 'Leaderboards') await leaderboard(panel);
}
function exchangeKey(points) {
  const k = 'tsd.arcade.exchange.' + user.id;
  let pending;
  try {
    pending = JSON.parse(localStorage.getItem(k));
  } catch {}
  if (pending && pending.points !== points) {
    throw new Error('An exchange is pending. Retry the same amount before starting another.');
  }
  if (!pending) {
    pending = { points, key: crypto.randomUUID() };
    localStorage.setItem(k, JSON.stringify(pending));
  }
  return pending.key;
}
async function statistics(panel) {
  const [defs, periods] = await Promise.all([
    checked(client.from('arcade_stat_definitions').select('*')),
    checked(
      client.from('arcade_periods').select('*').order('starts_at', { ascending: false }).limit(100),
    ),
  ]);
  panel.append(
    el('p', 'Practice records never award currency, achievements, or leaderboard places.', {
      class: 'ap-note',
    }),
  );
  const filters = el('div', null, { class: 'ap-filters' }),
    period = el('select', null, { 'aria-label': 'Statistics period' });
  for (const p of periods) {
    period.append(el('option', p.id === 'all' ? 'All time' : p.id, { value: p.id }));
  }
  period.value = 'all';
  filterLabel(filters, 'Period', period);
  panel.append(filters);
  const out = el('div', null);
  panel.append(out);
  let request = 0;
  const load = async () => {
    const seq = ++request,
      stats = await checked(
        client.from('arcade_stats').select('*').eq('period_id', period.value).limit(500),
      );
    if (seq !== request) return;
    out.replaceChildren();
    table(
      out,
      ['Game', 'Statistic', 'Value', 'Validation'],
      stats.map((s) => [
        names[s.game_id] || s.game_id,
        defs.find((d) => d.game_id === s.game_id && d.stat === s.stat)?.label || s.stat,
        format(s.value),
        s.verified ? 'Server verified' : 'Practice · unverified',
      ]),
    );
  };
  period.onchange = () => load().catch((e) => status(e.message, true));
  await load();
  const casino = await checked(
    client.from('arcade_casino_stats').select('*').eq('period_id', 'all').limit(25),
  );
  if (casino.length) {
    panel.append(el('h3', 'Casino performance'));
    table(
      panel,
      ['Game', 'Rounds', 'Wins', 'Net chips', 'Largest payout'],
      casino.map(
        (s) => [s.game_id, s.rounds, s.wins, format(s.net_winnings), format(s.largest_payout)],
      ),
    );
  }
}
async function wallet(panel) {
  const [w, info, ledger] = await Promise.all([
    checked(client.from('arcade_wallets').select('*').single()),
    rpc('arcade_exchange_info'),
    checked(client.from('arcade_ledger').select('*').order('id', { ascending: false }).limit(25)),
  ]);
  metrics(panel, [['Arcade Points', w.arcade_points], ['Casino chips', w.casino_chips], [
    'Lifetime earned',
    w.lifetime_earned,
  ], ['Points spent', w.lifetime_spent]]);
  panel.append(
    el('p', 'Virtual currencies only. No purchases, cash value, redemption, or transfers.', {
      class: 'ap-note',
    }),
  );
  if (!info.exchange_enabled) {
    panel.append(el('p', 'Exchange will open after the conversion rate is approved.'));
  } else {
    const f = form(panel, async () => {
      const points = Number(input.value);
      if (!Number.isSafeInteger(points) || points <= 0 || points % info.points_per_unit) {
        throw new Error('Choose a valid multiple of ' + info.points_per_unit);
      }
      await rpc('arcade_exchange', { p_key: exchangeKey(points), p_points: points });
      localStorage.removeItem('tsd.arcade.exchange.' + user.id);
      render();
    });
    const input = field(
      f,
      `Arcade Points (${info.points_per_unit} points → ${info.chips_per_unit} chips)`,
      'points',
      'number',
    );
    input.min = info.points_per_unit;
    input.step = info.points_per_unit;
    input.max = Math.min(w.arcade_points, info.max_exchange_points);
    const preview = el('p', 'Choose an amount to preview.');
    f.append(preview);
    input.addEventListener(
      'input',
      () =>
        preview.textContent = `Receive ${
          format(Math.floor(Number(input.value) / info.points_per_unit) * info.chips_per_unit)
        } casino chips`,
    );
    submit(f, 'Confirm Exchange');
  }
  panel.append(el('h3', 'Recent transactions'));
  table(
    panel,
    ['Date', 'Currency', 'Change', 'Balance'],
    ledger.map(
      (l) => [
        new Date(l.created_at).toLocaleString(),
        l.currency.replaceAll('_', ' '),
        format(l.delta),
        format(l.balance_after),
      ],
    ),
  );
}
const format = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
function filterLabel(parent, text, select) {
  const label = el('label', text);
  label.append(select);
  parent.append(label);
}
function metrics(parent, pairs) {
  const grid = el('div', null, { class: 'ap-metrics' });
  for (const [label, value] of pairs) {
    const d = el('div', null, { class: 'ap-metric' });
    d.append(el('strong', format(value)), el('span', label));
    grid.append(d);
  }
  parent.append(grid);
}
function table(parent, heads, rows) {
  const wrap = el('div', null, {
      class: 'ap-table-wrap',
      tabindex: '0',
      'aria-label': 'Scrollable records',
      role: 'region',
    }),
    t = el('table', null, { class: 'ap-table' }),
    h = el('tr', null);
  heads.forEach((x) => h.append(el('th', x, { scope: 'col' })));
  const thead = el('thead', null);
  thead.append(h);
  t.append(thead);
  const body = el('tbody', null);
  for (const row of rows) {
    const r = el('tr', null);
    for (const cell of row) {
      const d = el('td', null);
      d.append(cell instanceof Node ? cell : document.createTextNode(String(cell)));
      r.append(d);
    }
    body.append(r);
  }
  t.append(body);
  wrap.append(t);
  parent.append(wrap);
  if (!rows.length) {
    parent.append(
      el('p', 'No records yet. Your activity will appear here as you play.', { class: 'ap-empty' }),
    );
  }
}
async function leaderboard(panel) {
  const [defs, periods] = await Promise.all([
    checked(client.from('arcade_stat_definitions').select('*')),
    checked(
      client.from('arcade_periods').select('*').order('starts_at', { ascending: false }).limit(100),
    ),
  ]);
  const filters = el('div', null, { class: 'ap-filters' }),
    game = el('select', null, { 'aria-label': 'Leaderboard game' }),
    stat = el('select', null, { 'aria-label': 'Leaderboard statistic' }),
    period = el('select', null, { 'aria-label': 'Ranking period' });
  for (const id of ['arcade', 'cruise', 'cutup', 'ripagolf', 'casino']) {
    game.append(el('option', names[id] || 'Casino', { value: id }));
  }
  for (const p of periods) {
    period.append(
      el('option', p.id === 'all' ? 'All time' : p.id + (p.frozen_at ? ' · Final' : ''), {
        value: p.id,
      }),
    );
  }
  period.value = 'all';
  filterLabel(filters, 'Game', game);
  filterLabel(filters, 'Statistic', stat);
  filterLabel(filters, 'Period', period);
  panel.append(filters);
  const out = el('div', null);
  panel.append(out);
  let page = 0, request = 0;
  function options() {
    stat.replaceChildren();
    for (const d of defs.filter((d) => d.game_id === game.value)) {
      stat.append(el('option', d.label, { value: d.stat }));
    }
  }
  async function load() {
    const seq = ++request;
    out.replaceChildren();
    if (game.value === 'casino') {
      out.append(el('p', 'Casino rankings will become available when casino games are added.'));
      return;
    }
    const data = await rpc('arcade_leaderboard', {
      p_game: game.value,
      p_stat: stat.value,
      p_period: period.value,
      p_page: page,
    });
    if (seq !== request) return;
    if (!data.enabled) {
      out.append(
        el(
          'p',
          'Competitive rankings are awaiting validation and rule approval. Practice records remain private.',
        ),
      );
      return;
    }
    out.append(
      el('p', `${data.total} ranked players · Your position: ${data.own?.rank ?? 'Not ranked'}`),
    );
    table(
      out,
      ['Rank', 'Player', 'Value'],
      data.rows.map((r) => {
        const b = el('button', r.username, { type: 'button' });
        b.onclick = async () => {
          try {
            const p = await rpc('arcade_public_profile', { p_user: r.user_id });
            const c = el('div', null, { class: 'ap-profile' });
            if (!p) c.textContent = 'This player keeps their profile private.';
            else {
              c.append(el('h3', p.profile.username));
              table(
                c,
                ['Game', 'Statistic', 'Value'],
                p.stats.map((s) => [names[s.game_id], s.stat, format(s.value)]),
              );
            }
            out.querySelector('.ap-profile')?.remove();
            out.append(c);
          } catch (e) {
            status(e.message, true);
          }
        };
        return [r.rank, b, format(r.value)];
      }),
    );
    const nav = el('div', null, { class: 'ap-actions' });
    out.append(nav);
    if (page > 0) {
      button('Previous', async () => {
        page--;
        await load();
      }, nav);
    }
    if ((page + 1) * 25 < data.total) {
      button('Next', async () => {
        page++;
        await load();
      }, nav);
    }
    out.append(
      el(
        'p',
        'Verified results from opted-in players only. Equal values share a rank; ties display by first attainment, then player ID. Weeks start Monday at 00:00 UTC. Balances are never ranked.',
        { class: 'ap-note' },
      ),
    );
  }
  for (const select of [game, stat, period]) {
    select.onchange = () => {
      if (select === game) options();
      page = 0;
      load().catch((e) => status(e.message, true));
    };
  }
  options();
  await load();
}
client.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && user?.id === session?.user.id) return;
  if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') return;
  if (event === 'PASSWORD_RECOVERY') recovery = true;
  setTimeout(() => refresh(), 0);
});
window.addEventListener('online', () => refresh());
await refresh();
