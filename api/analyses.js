import { getSupabaseServer, apiJson, databaseError } from '../lib/supabaseServer.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  // Public access requires both server opt-in and per-analysis publication.
  if (process.env.SARSCOPE_PUBLIC_ANALYSES !== 'true') return apiJson({ analyses: [], enabled: false });
  const id = new URL(request.url).searchParams.get('id');
  if (id !== null && !uuid.test(id)) return apiJson({ error: 'INVALID_ANALYSIS_ID' }, 400);
  try {
    const client = getSupabaseServer();
    let query = client.from('analyses')
      .select('id,before_scene_id,after_scene_id,model_version,threshold,validation_status,created_at')
      .eq('status', 'completed').eq('summary->>published', 'true')
      .order('created_at', { ascending: false }).limit(id ? 1 : 20);
    if (id) query = query.eq('id', id);
    const { data, error } = await query;
    if (error) throw error;
    if (!id) return apiJson({ analyses: data, enabled: true });
    if (!data.length) return apiJson({ error: 'ANALYSIS_NOT_FOUND' }, 404);
    const result = await client.from('analysis_assets')
      .select('layer_type,format,storage_bucket,storage_path,crs,bounds,image_corners').eq('analysis_id', id);
    if (result.error) throw result.error;
    const assets = await Promise.all(result.data.map(async asset => {
      if (asset.storage_bucket !== 'sarscope-data' || !asset.storage_path.startsWith(`analyses/${id}/`) ||
          asset.storage_path.split('/').some(part => part === '..' || part === '.')) throw new Error();
      const signed = await client.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 600);
      if (signed.error) throw signed.error;
      return { layer_type: asset.layer_type, format: asset.format, crs: asset.crs,
        bounds: asset.bounds, image_corners: asset.image_corners, url: signed.data.signedUrl };
    }));
    return apiJson({ analysis: data[0], assets, urls_expire_at: new Date(Date.now() + 600000).toISOString() });
  } catch (error) { return databaseError(error); }
}
