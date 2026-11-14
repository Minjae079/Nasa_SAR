import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as status } from '../api/database-status.js';
import { GET as results } from '../api/model-results.js';
import { isPublicFile } from '../lib/staticFiles.js';
import { parseModelManifest } from '../lib/modelManifest.js';

test('static serving excludes secrets and server files', () => {
  for (const file of ['/.env.local', '/.git/config', '/node_modules/pkg/index.js',
    '/lib/supabaseServer.js', '/supabase/results-manifest.json', '/package-lock.json',
    '/assets/../.env']) assert.equal(isPublicFile(file), false);
  assert.equal(isPublicFile('/model-results.js'), true);
});
const sample = { id: 'run-1', title: 'Test output', published: true, observed_at: '2026-11-13T00:00:00Z',
  model_version: 'test-only', description: 'Test fixture', image_path: 'results/run-1/output.png' };
test('manifest signs only explicitly published PNG paths', () => {
  assert.equal(parseModelManifest({ version: 1, results: [{ published: false }, sample] }).length, 1);
  for (const image_path of ['private/output.png', 'results/../secret.png', 'results/%2e%2e/output.png',
    'https://other.example/output.png', 'results/output.svg']) {
    assert.throws(() => parseModelManifest({ version: 1, results: [{ ...sample, image_path }] }));
  }
  assert.throws(() => parseModelManifest({ version: 1, results: [sample, sample] }));
  const classes = ['Inundated vegetation', 'Dry vegetation', 'Open water', 'Other']
    .map((name, id) => ({ id, name, color: '#123456' }));
  assert.deepEqual(parseModelManifest({ version: 1, results: [{ ...sample, classes }] })[0].classes, classes);
  assert.throws(() => parseModelManifest({ version: 1, results: [{ ...sample,
    classes: classes.map(item => ({ ...item, color: 'url(unsafe)' })) }] }));
});
test('Storage-only APIs cover setup, missing files, publication and signing', async () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY,
    enabled: process.env.SARSCOPE_PUBLIC_ANALYSES, fetch: globalThis.fetch };
  try {
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await status()).status, 503);
    process.env.SARSCOPE_PUBLIC_ANALYSES = 'false';
    assert.equal((await (await results(new Request('https://site/api/model-results'))).json()).state, 'disabled');
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
    process.env.SARSCOPE_PUBLIC_ANALYSES = 'true';
    let manifest = { version: 1, results: [] };
    let publicBucket = false;
    let missing = false;
    let signedCount = 0;
    globalThis.fetch = async (input, options) => {
      const url = new URL(input);
      assert.equal(url.pathname.startsWith('/rest/'), false, 'No database queries');
      assert.equal(options.headers.get('apikey'), 'sb_secret_test_only');
      if (url.pathname.includes('/bucket/')) return Response.json({ id: 'sarscope-data', public: publicBucket });
      if (url.pathname.includes('/object/sign/')) {
        signedCount++;
        assert.equal(JSON.parse(options.body).expiresIn, 600);
        return Response.json({ signedURL: '/object/sign/sarscope-data/results/output.png?token=test' });
      }
      return missing ? Response.json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, { status: 400 })
        : Response.json(manifest);
    };
    assert.deepEqual(await (await status()).json(), { connected: true, storage: 'ready', mode: 'files-only' });
    publicBucket = true;
    assert.equal((await status()).status, 503);
    publicBucket = false;
    assert.equal((await (await results(new Request('https://site/api/model-results'))).json()).state, 'empty');
    missing = true;
    assert.equal((await (await results(new Request('https://site/api/model-results'))).json()).state, 'awaiting_upload');
    missing = false;
    manifest.results = [sample, { ...sample, id: 'private-run', published: false }];
    const response = await results(new Request('https://site/api/model-results'));
    const body = await response.json();
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0].image_path, undefined);
    assert.ok(body.results[0].image_url.startsWith('https://example.supabase.co/storage/v1/'));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(signedCount, 1);
    assert.equal((await results(new Request('https://site/api/model-results?id=private-run'))).status, 404);
    assert.equal((await results(new Request('https://site/api/model-results?id=../secret'))).status, 400);
    manifest.results = [{ ...sample, image_path: 'private/output.png' }];
    assert.equal((await results(new Request('https://site/api/model-results'))).status, 502);
    assert.equal(signedCount, 1);
    globalThis.fetch = async () => Response.json({ message: 'sensitive details' }, { status: 401 });
    const failure = await status();
    assert.equal(failure.status, 502);
    assert.equal((await failure.text()).includes('sensitive details'), false);
  } finally {
    for (const [key, value] of [['SUPABASE_URL', saved.url], ['SUPABASE_SECRET_KEY', saved.key],
      ['SARSCOPE_PUBLIC_ANALYSES', saved.enabled]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    globalThis.fetch = saved.fetch;
  }
});

