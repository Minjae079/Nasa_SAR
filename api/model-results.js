import { getSupabaseServer, apiJson, databaseError } from '../lib/supabaseServer.js';
import { parseModelManifest, InvalidManifestError } from '../lib/modelManifest.js';

export async function GET(request) {
  // Retain the existing environment variable; it now controls file publication.
  if (process.env.SARSCOPE_PUBLIC_ANALYSES !== 'true') return apiJson({ results: [], state: 'disabled' });
  const id = new URL(request.url).searchParams.get('id');
  if (id !== null && !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return apiJson({ error: 'INVALID_RESULT_ID' }, 400);
  try {
    const client = getSupabaseServer();
    const bucket = client.storage.from('sarscope-data');
    const download = await bucket.download('results/manifest.json');
    if (download.error) {
      // Supabase may return HTTP 400 with a 404 error payload for absent objects.
      if (String(download.error.statusCode) === '404' || download.error.code === 'NoSuchKey') {
        return apiJson({ results: [], state: 'awaiting_upload' });
      }
      throw download.error;
    }
    if (download.data.size > 256000) throw new InvalidManifestError();
    let value;
    try { value = JSON.parse(await download.data.text()); } catch { throw new InvalidManifestError(); }
    let rows = parseModelManifest(value);
    if (id) {
      rows = rows.filter(row => row.id === id);
      if (!rows.length) return apiJson({ error: 'RESULT_NOT_FOUND' }, 404);
    }
    const results = await Promise.all(rows.map(async ({ image_path, ...row }) => {
      const signed = await bucket.createSignedUrl(image_path, 600);
      if (signed.error) throw signed.error;
      return { ...row, image_url: signed.data.signedUrl };
    }));
    return apiJson({ results, state: results.length ? 'ready' : 'empty',
      urls_expire_at: new Date(Date.now() + 600000).toISOString() });
  } catch (error) {
    if (error instanceof InvalidManifestError) return apiJson({ error: 'INVALID_RESULTS_MANIFEST' }, 502);
    return databaseError(error);
  }
}
