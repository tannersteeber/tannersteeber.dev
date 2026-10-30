import { createClient } from './vendor.js';
import { config } from './config.js';
export const client = createClient(config.url, config.publishableKey, {
  auth: {
    storageKey: 'tsd.arcade.auth.v1',
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
export async function checked(result) {
  const { data, error } = await result;
  if (error) throw error;
  return data;
}
export const rpc = (name, args = {}) => checked(client.rpc(name, args));
export async function player() {
  const data = await checked(client.auth.getUser());
  if (!data.user || !data.user.email_confirmed_at || data.user.is_anonymous) {
    throw new Error('Sign in with a verified account to play.');
  }
  return data.user;
}
export const callbackUrl = () => new URL('arcade.html', new URL('../../', import.meta.url)).href;
export async function invoke(body) {
  const { data, error } = await client.functions.invoke('arcade-api', { body });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    const failure = new Error(message);
    if (error.context?.status === 409) failure.code = '40001';
    throw failure;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export function scopedKey(key) {
  return `${key}.${window.ArcadePlayer.id}`;
}
