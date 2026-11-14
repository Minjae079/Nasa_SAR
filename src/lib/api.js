// This module is safe for browsers: Supabase credentials stay in /api and /lib.
export async function fetchJson(path, { signal } = {}) {
  const response = await fetch(path, {
    cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error('Request failed'), { code: data.error });
  return data;
}
