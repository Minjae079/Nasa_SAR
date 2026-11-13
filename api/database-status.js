import { getSupabaseServer, apiJson, databaseError } from '../lib/supabaseServer.js';

export async function GET() {
  try {
    const client = getSupabaseServer();
    const checks = await Promise.all([
      ...['scenes', 'analyses', 'analysis_assets'].map(table => client.from(table).select('id').limit(1)),
      client.storage.getBucket('sarscope-data'),
    ]);
    if (checks.some(check => check.error)) throw new Error();
    if (checks[3].data.public !== false) return apiJson({ connected: false, error: 'STORAGE_MUST_BE_PRIVATE' }, 503);
    return apiJson({ connected: true, database: 'ready', storage: 'ready' });
  } catch (error) { return databaseError(error); }
}
