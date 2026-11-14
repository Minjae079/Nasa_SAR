import { getSupabaseServer, apiJson, databaseError } from '../lib/supabaseServer.js';

export async function GET() {
  try {
    const client = getSupabaseServer();
    const { data, error } = await client.storage.getBucket('sarscope-data');
    if (error) throw error;
    if (data.public !== false) return apiJson({ connected: false, error: 'STORAGE_MUST_BE_PRIVATE' }, 503);
    return apiJson({ connected: true, storage: 'ready', mode: 'files-only' });
  } catch (error) { return databaseError(error); }
}
