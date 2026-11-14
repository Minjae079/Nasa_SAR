import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { demoMiddleware } from '../lib/demoResults.js';
import { parseModelManifest } from '../lib/modelManifest.js';

test('local demo serves only listed fixture images, not arbitrary paths or public results', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sarscope-demo-test-'));
  try {
    await fs.mkdir(path.join(root, 'demo-1234abcd'));
    const png = Buffer.from([137,80,78,71,13,10,26,10]);
    await fs.writeFile(path.join(root, 'demo-1234abcd/prediction.png'), png);
    const row = { id: 'demo-prediction', image_file: 'demo-1234abcd/prediction.png', published: false,
      synthetic: true, title: 'Fixture only' };
    await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ synthetic: true, results: [row] }));
    async function request(url, method = 'GET') {
      const result = {};
      await demoMiddleware(root)({ url, method }, {
        writeHead(status, headers) { result.status = status; result.headers = headers; },
        end(body) { result.body = body; },
      }, () => { result.next = true; });
      return result;
    }
    const list = await request('/api/demo-results');
    const json = JSON.parse(list.body);
    assert.equal(json.synthetic, true);
    assert.equal(json.results[0].is_demo, true);
    assert.equal(json.results[0].image_file, undefined);
    const image = await request(json.results[0].image_url);
    assert.equal(image.headers['Content-Type'], 'image/png');
    assert.deepEqual(image.body, png);
    assert.equal((await request('/api/demo-image?id=../../.env.local')).status, 404);
    assert.equal((await request('/api/demo-results', 'POST')).status, 405);
    assert.equal((await request('/api/model-results')).next, true);
    assert.throws(() => parseModelManifest({ version: 1, results: [{ ...row, published: true }] }));
  } finally {
    // Only this newly created test temp directory is removed.
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
        !path.basename(root).startsWith('sarscope-demo-test-')) throw new Error('Unexpected temp path');
    await fs.rm(root, { recursive: true, force: true });
  }
});
