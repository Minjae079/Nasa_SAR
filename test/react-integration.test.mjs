import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

test('React shell, Vite HTTP assets and API adapter work without exposing env files', async () => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SARSCOPE_PUBLIC_ANALYSES'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const nativeFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_integration_test';
  process.env.SARSCOPE_PUBLIC_ANALYSES = 'true';
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith('https://example.supabase.co/')) {
      return Response.json(String(input).includes('/bucket/')
        ? { id: 'sarscope-data', public: false } : { version: 1, results: [] });
    }
    return nativeFetch(input, options);
  };
  let server;
  try {
    server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    const home = await nativeFetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /src\/main.jsx/);
    const entry = await nativeFetch(base + '/src/main.jsx');
    assert.equal(entry.status, 200);
    assert.match(await entry.text(), /createRoot/);
    const status = await nativeFetch(base + '/api/database-status');
    assert.deepEqual(await status.json(), { connected: true, storage: 'ready', mode: 'files-only' });
    const results = await nativeFetch(base + '/api/model-results');
    assert.equal((await results.json()).state, 'empty');
    assert.equal((await nativeFetch(base + '/api/unknown')).status, 404);
    assert.equal((await nativeFetch(base + '/api/model-results', { method: 'POST' })).status, 405);
    const env = await nativeFetch(base + '/.env.local');
    assert.ok([403, 404].includes(env.status));
    assert.equal((await env.text()).includes('SUPABASE_SECRET_KEY='), false);
    assert.equal((await nativeFetch(base + '/lib/supabaseServer.js')).status, 403);

    const { App } = await server.ssrLoadModule('/src/App.jsx');
    const markup = renderToString(createElement(App));
    for (const id of ['globeViz', 'globeScene', 'compareScene', 'mapScene', 'aboutModal',
      'loadModelResults', 'checkDatabase', 'zoomInGlobe', 'beforeImage', 'afterImage']) {
      assert.ok(markup.includes(`id="${id}"`), id);
    }
    assert.ok(markup.indexOf('id="compareScene"') < markup.indexOf('id="mapScene"'));
  } finally {
    await server?.close();
    globalThis.fetch = nativeFetch;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
