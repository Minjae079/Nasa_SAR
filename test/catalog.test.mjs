import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_SCENES, localScenesFor, selectPairs } from '../lib/sarCatalog.js';
import { GET as getCoverage } from '../api/coverage.js';
import { GET as getPreview } from '../api/preview.js';

const lat=41.83531,lon=-87.627;
test('IIT uploaded ASF catalog contains 185 unique scenes, 32 GCOV, 4 real temporal groups',()=>{
  assert.equal(LOCAL_SCENES.length,185);
  const scenes=localScenesFor(lon,lat);
  const {available,pairs}=selectPairs(scenes,lon,lat);
  assert.equal(available,32);
  assert.equal(pairs.length,4);
  assert.equal(pairs[0].before.date,'2026-10-10');
  assert.equal(pairs[0].after.date,'2026-10-22');
  assert.equal(pairs[0].track,'148');
  assert.equal(pairs[0].frame,'23');
  assert.equal(pairs[0].dayGap,12);
  assert.ok(pairs.every(x=>x.before.date<x.after.date));
});

test('No local IIT acquisitions incorrectly returned for a distant point',()=>{
  assert.equal(localScenesFor(0,0).length,0);
});

test('Coverage returns real uploaded IIT pairs when ASF API is unavailable',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('simulated offline');};
  try {
    const result=await getCoverage(new Request(`http://localhost/api/coverage?lat=${lat}&lng=${lon}`));
    assert.equal(result.status,200);
    const json=await result.json();
    assert.equal(json.source,'iit-archive-fallback');
    assert.equal(json.matchedGCOVObservations,32);
    assert.equal(json.pairs.length,4);
  } finally {globalThis.fetch=old;}
});

test('Reject bad coordinates and unsafe NASA proxy URL',async()=>{
  const coverage=await getCoverage(new Request('http://localhost/api/coverage?lat=999&lng=0'));
  assert.equal(coverage.status,400);
  const preview=await getPreview(new Request('http://localhost/api/preview?url=https%3A%2F%2Fevil.example%2FBROWSE%2Fa.png'));
  assert.equal(preview.status,400);
});

test('Only valid NASA PNG bytes are proxied, never HTML redirects',async()=>{
  const real=selectPairs(localScenesFor(lon,lat),lon,lat).pairs[0].after.browse;
  const old=globalThis.fetch;
  globalThis.fetch=async()=>new Response(new Uint8Array([137,80,78,71,13,10,26,10,0,1]),{headers:{'Content-Type':'image/png'}});
  try {
    const result=await getPreview(new Request('http://localhost/api/preview?url='+encodeURIComponent(real)));
    assert.equal(result.status,200);
    assert.equal(result.headers.get('Content-Type'),'image/png');
  } finally {globalThis.fetch=old;}
});
