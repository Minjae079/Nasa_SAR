import { createClient } from '@supabase/supabase-js';

export class SupabaseConfigurationError extends Error {}
export function getSupabaseServer(env = process.env) {
  const key = env.SUPABASE_SECRET_KEY;
  if (!env.SUPABASE_URL || !key) throw new SupabaseConfigurationError();
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch { throw new SupabaseConfigurationError(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || !key.startsWith('sb_secret_')) {
    throw new SupabaseConfigurationError();
  }
  return createClient(url.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
  });
}
export function apiJson(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function databaseError(error) {
  // Never expose upstream errors, headers or secrets to browsers.
  return apiJson({ connected: false, error: error instanceof SupabaseConfigurationError
    ? 'SUPABASE_NOT_CONFIGURED' : 'SUPABASE_UNAVAILABLE' },
  error instanceof SupabaseConfigurationError ? 503 : 502);
}
