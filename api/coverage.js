import { localScenesFor, fetchLiveScenes, mergeScenes, selectPairs, LOCAL_SCENES } from '../lib/sarCatalog.js';

export async function GET(request) {
  const url=new URL(request.url);
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 ||
      url.searchParams.get('lat')===null || url.searchParams.get('lng')===null) {
    return Response.json({error:'Valid lat and lng parameters are required.'},{status:400});
  }
  const local=localScenesFor(lon,lat);
  let live=[], warning=null, source='asf-live';
  try { live=await fetchLiveScenes(lon,lat); }
  catch(err) { warning=`ASF live search unavailable: ${err.message}`; source='iit-archive-fallback'; }
  const features=mergeScenes(local,live);
  const {available,pairs}=selectPairs(features,lon,lat);
  if (!live.length && local.length) source='iit-archive-fallback';
  return Response.json({
    lat, lng:lon, source, searchCoverage:'NISAR L-band GCOV',
    archiveDate:'2026-11-03',
    localCatalogProducts: LOCAL_SCENES.length,
    matchedGCOVObservations:available,
    pairs:pairs.slice(0,12),
    warning,
    caution:'Images are NASA ASF full-scene browse previews, NOT AOI-cropped, co-registered IIT images, and do not prove surface change.'
  },{headers:{'Cache-Control':'public, s-maxage=900, stale-while-revalidate=3600'}});
}
