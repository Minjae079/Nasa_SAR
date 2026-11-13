import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as status } from '../api/database-status.js';
import { GET as analyses } from '../api/analyses.js';
import { isPublicFile } from '../lib/staticFiles.js';

test('workspace secrets and server files cannot be served as static assets', () => {
  for (const file of ['/.env.local', '/.git/config', '/node_modules/pkg/index.js',
    '/lib/supabaseServer.js', '/supabase/README.md', '/package-lock.json', '/assets/../.env',
    '/assets/a\\..\\.env.png']) assert.equal(isPublicFile(file), false, file);
  for (const file of ['/index.html', '/database-status.js', '/assets/sky/constellation-sky.svg',
    '/data/sar_layers.json']) assert.equal(isPublicFile(file), true, file);
});

test('database APIs handle missing keys, empty results, failures and private publication', async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY,
    enabled: process.env.SARSCOPE_PUBLIC_ANALYSES, fetch: globalThis.fetch };
  try {
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await status()).status, 503);
    process.env.SARSCOPE_PUBLIC_ANALYSES = 'false';
    assert.deepEqual(await (await analyses(new Request('https://site/api/analyses'))).json(),
      { analyses: [], enabled: false });
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
    process.env.SARSCOPE_PUBLIC_ANALYSES = 'true';
    const calls = [];
    globalThis.fetch = async (input, options) => {
      const url = new URL(input);
      calls.push(url);
      assert.equal(options.headers.get('apikey'), 'sb_secret_test_only');
      return Response.json(url.pathname.includes('/bucket/') ? { id: 'sarscope-data', public: false } : []);
    };
    assert.deepEqual(await (await status()).json(), { connected: true, database: 'ready', storage: 'ready' });
    const empty = await analyses(new Request('https://site/api/analyses'));
    assert.deepEqual(await empty.json(), { analyses: [], enabled: true });
    const list = calls.find(url => url.pathname.endsWith('/analyses') && url.searchParams.has('status'));
    assert.equal(list.searchParams.get('status'), 'eq.completed');
    assert.equal(list.searchParams.get('summary->>published'), 'eq.true');
    const id = '10000000-0000-4000-8000-000000000001';
    assert.equal((await analyses(new Request(`https://site/api/analyses?id=${id}`))).status, 404);
    assert.equal((await analyses(new Request('https://site/api/analyses?id=invalid'))).status, 400);
    let assetPath = `analyses/${id}/change.png`;
    let signedRequests = 0;
    globalThis.fetch = async input => {
      const url = new URL(input);
      if (url.pathname.endsWith('/analyses')) return Response.json([{ id }]);
      if (url.pathname.endsWith('/analysis_assets')) return Response.json([
        { layer_type: 'change', format: 'png', storage_bucket: 'sarscope-data', storage_path: assetPath },
      ]);
      signedRequests++;
      return Response.json({ signedURL: '/object/sign/sarscope-data/change.png?token=test' });
    };
    const detail = await analyses(new Request(`https://site/api/analyses?id=${id}`));
    assert.equal(detail.status, 200);
    const body = await detail.json();
    assert.match(body.assets[0].url, /^https:\/\/example.supabase.co\/storage\/v1\//);
    assert.equal(body.assets[0].storage_path, undefined);
    assert.equal(signedRequests, 1);
    assetPath = 'private/other-run.png';
    assert.equal((await analyses(new Request(`https://site/api/analyses?id=${id}`))).status, 502);
    assert.equal(signedRequests, 1);
    globalThis.fetch = async () => Response.json({ message: 'private upstream details' }, { status: 401 });
    const failure = await status();
    assert.equal(failure.status, 502);
    assert.equal((await failure.text()).includes('private upstream details'), false);
  } finally {
    for (const [name, value] of [['SUPABASE_URL', previous.url], ['SUPABASE_SECRET_KEY', previous.key],
      ['SARSCOPE_PUBLIC_ANALYSES', previous.enabled]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    globalThis.fetch = previous.fetch;
  }
});
