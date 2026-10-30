import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { GOLF_VERSION, validateGolf } from './golf-validator.js';
const canonical = (x: unknown): string =>
  JSON.stringify(
    x,
    (_, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
        : v,
  );
const allowedOrigins = new Set([
  'https://tannersteeber.dev',
  'https://www.tannersteeber.dev',
  'http://127.0.0.1:8766',
  'http://localhost:8766',
]);
const json = (value: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
export async function handle(
  req: Request,
  dependencies = { createClient, env: (key: string) => Deno.env.get(key) },
) {
  const origin = req.headers.get('origin') || '';
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin)
      ? origin
      : 'https://tannersteeber.dev',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: 'Origin is not permitted' }, 403, headers);
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405, headers);
  try {
    // Always validate a real user. A publishable API key is not a user identity.
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) {
      return json({ error: 'Sign in required' }, 401, headers);
    }
    const url = dependencies.env('SUPABASE_URL')!,
      anon = dependencies.env('SUPABASE_ANON_KEY')!,
      secret = dependencies.env('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller = dependencies.createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user?.email_confirmed_at || user.is_anonymous) {
      return json({ error: 'Verified account required' }, 401, headers);
    }
    // This RPC also checks auth.sessions for immediate logout/revocation and account bans.
    const { error: activeError } = await caller.rpc('arcade_exchange_info');
    if (activeError) return json({ error: 'Session expired. Sign in again.' }, 401, headers);
    let size = 0;
    const chunks = [];
    const reader = req.body?.getReader();
    if (!reader) return json({ error: 'JSON body required' }, 400, headers);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        return json({ error: 'Request too large' }, 413, headers);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    const admin = dependencies.createClient(url, secret, { auth: { persistSession: false } });
    if (body.action === 'delete-account') {
      // Require a fresh password login, not merely a refreshed or stolen long-lived session.
      const claims = JSON.parse(
        atob(authorization.slice(7).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (
        !Array.isArray(claims.amr) ||
        !claims.amr.some((x: { method: string; timestamp: number }) =>
          x.method === 'password' && Date.now() / 1000 - x.timestamp < 300
        )
      ) return json({ error: 'Sign in with your password again before deletion.' }, 403, headers);
      await admin.auth.admin.signOut(authorization.slice(7), 'global');
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw error;
      return json({ deleted: true }, 200, headers);
    }
    if (
      body.action !== 'golf' || !isUuid(body.session) || !isUuid(body.key) ||
      !Number.isInteger(body.revision)
    ) return json({ error: 'Invalid request' }, 400, headers);
    const { data: session, error: sessionError } = await admin.from('arcade_sessions').select('*')
      .eq('id', body.session).eq('user_id', user.id).single();
    if (
      sessionError || session.game_id !== 'ripagolf' || session.validator_version !== GOLF_VERSION
    ) return json({ error: 'Run unavailable' }, 404, headers);
    const request = {
      operation: body.operation,
      ...(body.operation === 'shot'
        ? { spec: body.spec, wait: body.wait ?? 0 }
        : body.operation === 'prediction'
        ? { prediction: body.prediction }
        : {}),
    };
    const { data: previous, error: previousError } = await admin.from('arcade_events').select(
      'request,response',
    ).eq('session_id', session.id).eq('request_key', body.key).maybeSingle();
    if (previousError) throw previousError;
    if (previous) {
      if (canonical(previous.request) !== canonical(request)) {
        return json({ error: 'Request key already used' }, 409, headers);
      }
      return json(previous.response, 200, headers);
    }
    if (
      session.status !== 'active' || new Date(session.expires_at).getTime() < Date.now() ||
      session.revision !== body.revision
    ) return json({ error: 'Run changed on another device. Reload to restore it.' }, 409, headers);
    const { error: limitError } = await admin.rpc('arcade_request_limit', { p_user: user.id });
    if (limitError) return json({ error: 'Too many requests. Try again shortly.' }, 429, headers);
    const result = validateGolf(session, request),
      response = { state: result.state, revision: session.revision + 1 };
    const { data, error } = await admin.rpc('arcade_verified_commit', {
      p_user: user.id,
      p_session: session.id,
      p_revision: body.revision,
      p_key: body.key,
      p_request: request,
      p_state: result.state,
      p_metrics: result.metrics,
      p_response: response,
      p_finished: result.finished,
    });
    if (error) {
      return json(
        {
          error: error.code === '40001'
            ? 'Run changed. Reload before continuing.'
            : 'Could not save the shot. Retry the same request.',
        },
        409,
        headers,
      );
    }
    return json(data, 200, headers);
  } catch (error) {
    console.error('Arcade request rejected', error instanceof Error ? error.name : 'unknown');
    return json(
      {
        error: error instanceof SyntaxError ? 'Invalid JSON' : error instanceof Error &&
            /Invalid|Unknown|Lock|Stroke|Win|Ball|Prediction|Shot/.test(error.message)
          ? error.message
          : 'Unable to complete this request. Try again.',
      },
      400,
      headers,
    );
  }
}
function isUuid(value: unknown) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
if (typeof Deno !== 'undefined') Deno.serve((req) => handle(req));
