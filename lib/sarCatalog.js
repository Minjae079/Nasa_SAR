import catalog from '../api/data/iit_catalog.json' with { type: 'json' };

export const LOCAL_SCENES = catalog.features;

function ringContains(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function contains(geometry, lon, lat) {
  if (!geometry || !geometry.coordinates) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] :
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  for (const polygon of polygons) {
    if (!polygon.length || !ringContains(polygon[0], lon, lat)) continue;
    if (polygon.slice(1).some(hole => ringContains(hole, lon, lat))) continue;
    return true;
  }
  return false;
}

function stringArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  // ASF JSON normally returns arrays. For alternate formats, avoid eval and
  // handle only simple quoted list values.
  if (value.startsWith('[')) {
    try { return JSON.parse(value.replaceAll("'", '"')); } catch { return []; }
  }
  return [value];
}

function preferredBrowse(p) {
  const urls = stringArray(p?.browse).filter(u => typeof u === 'string' && u.startsWith('https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/') && u.endsWith('.png'));
  return urls.find(u => u.endsWith('_LATLON.png')) ||
    urls.find(u => u.endsWith('_NATIVE_A_HHHH.png')) ||
    urls.find(u => u.endsWith('_NATIVE_A_VVVV.png')) ||
    urls.find(u => u.endsWith('_LATLON_thumbnail.png')) || null;
}

function normalize(feature, lon, lat) {
  const p = feature?.properties || {};
  const id = p.sceneName || p.fileID;
  if (!id || p.processingLevel !== 'GCOV' || !contains(feature.geometry, lon, lat)) return null;
  const browse = preferredBrowse(p);
  if (!browse) return null;
  const pol = stringArray(p.mainBandPolarization).sort().join(',') || 'unspecified';
  const acquisition = p.startTime || '';
  const tokens = id.split('_');
  const radarMode = tokens[9] || '';
  const bandwidthCode = tokens[8] || '';
  return {
    id, date: acquisition.slice(0, 10), acquisition,
    track: String(p.pathNumber ?? ''), frame: String(p.frameNumber ?? ''),
    direction: p.flightDirection || '', polarization: pol,
    crid: p.crid || '', collection: p.collectionName || '',
    radarMode, bandwidthCode, configuration:p.productionConfiguration || '',
    browse, source: p.url || null
  };
}

export function selectPairs(features, lon, lat) {
  const groups = new Map();
  const seen = new Set();
  let available = 0;
  for (const f of features) {
    const item = normalize(f, lon, lat);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id); available++;
    const key = [item.track,item.frame,item.direction,item.polarization,item.crid,item.radarMode,item.bandwidthCode,item.configuration].join('|');
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(item);
  }
  const pairs=[];
  for (const values of groups.values()) {
    values.sort((a,b)=>b.acquisition.localeCompare(a.acquisition));
    const dated=[];
    for (const v of values) if (!dated.some(x=>x.date===v.date)) dated.push(v);
    if (dated.length < 2) continue;
    // Match the two most recent *different* acquisition dates within this track/frame.
    const [after,before]=dated;
    pairs.push({ id:`${after.track}-${after.frame}-${after.direction}-${after.date}`,
      before, after,
      track:after.track,frame:after.frame,direction:after.direction,
      polarization:after.polarization,
      matchedObservations:dated.length,
      dayGap:Math.round((Date.parse(after.date)-Date.parse(before.date))/86400000) });
  }
  pairs.sort((a,b)=>b.after.date.localeCompare(a.after.date) || b.matchedObservations-a.matchedObservations);
  return { available, pairs };
}

export function localScenesFor(lon,lat) {
  // 185 real ASF products from uploaded 2026-11-03 IIT export;
  // client imagery uses only GCOV browse products.
  return LOCAL_SCENES.filter(f=>contains(f.geometry,lon,lat));
}

export async function fetchLiveScenes(lon,lat) {
  const params=new URLSearchParams({
    dataset:'NISAR', processingLevel:'GCOV',
    intersectsWith:`POINT(${lon} ${lat})`, output:'geojson',
    start:'2026-06-17', end:new Date().toISOString().slice(0,10),
    maxResults:'500'
  });
  const url='https://api.daac.asf.alaska.edu/services/search/param?'+params;
  const response=await fetch(url,{signal:AbortSignal.timeout(10500),headers:{'Accept':'application/geo+json, application/json'}});
  if (!response.ok) throw new Error(`ASF Search API returned HTTP ${response.status}`);
  const body=await response.json();
  if (!Array.isArray(body.features)) throw new Error('ASF response missing GeoJSON features');
  return body.features;
}

export function mergeScenes(a,b) {
  const map=new Map();
  for (const f of [...a,...b]) {
    const p=f?.properties || {};
    const id=p.sceneName || p.fileID;
    if (id) map.set(id,f);
  }
  return [...map.values()];
}
