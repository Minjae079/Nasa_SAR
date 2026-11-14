import test from 'node:test';
import assert from 'node:assert/strict';
import { publishModelResult } from '../tools/publish-model-result.mjs';

test('publisher preserves existing entries and uploads PNG before changing manifest', async () => {
  const entry = { id: 'new-run', published: true, title: 'Test fixture', observed_at: '2026-11-13T00:00:00Z',
    model_version: 'test', description: 'Test only', image_path: 'results/new-run/prediction.png' };
  const old = { ...entry, id: 'old-run', image_path: 'results/old-run/prediction.png' };
  const calls = [];
  const client = { storage: {
    getBucket: async () => ({ data: { public: false } }),
    from: () => ({
      download: async () => ({ data: new Blob([JSON.stringify({ version: 1, results: [old] })]) }),
      upload: async (file, content, options) => { calls.push({ file, content, options }); return {}; },
    }),
  } };
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  await publishModelResult(client, entry, png);
  assert.equal(calls[0].file, entry.image_path);
  assert.equal(calls[0].options.upsert, false);
  assert.equal(calls[1].file, 'results/manifest.json');
  assert.deepEqual(JSON.parse(calls[1].content).results.map(row => row.id), ['old-run', 'new-run']);
  calls.length = 0;
  await assert.rejects(publishModelResult(client, old, png), /already exists/);
  assert.equal(calls.length, 0);
});
