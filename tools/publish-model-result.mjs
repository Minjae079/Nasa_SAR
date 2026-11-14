import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { getSupabaseServer } from '../lib/supabaseServer.js';
import { parseModelManifest } from '../lib/modelManifest.js';

export async function publishModelResult(client, entry, png) {
  parseModelManifest({ version: 1, results: [entry] });
  if (entry.published !== true || entry.synthetic === true || entry.is_demo === true || !Buffer.from(png).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    throw new Error('Need a published model entry and a PNG file.');
  }
  const check = await client.storage.getBucket('sarscope-data');
  if (check.error || check.data?.public !== false) throw new Error('Private sarscope-data bucket required.');
  const bucket = client.storage.from('sarscope-data');
  const current = await bucket.download('results/manifest.json');
  let manifest = { version: 1, results: [] };
  if (current.error) {
    if (String(current.error.statusCode) !== '404' && current.error.code !== 'NoSuchKey') {
      throw new Error('Cannot read the existing manifest. No files changed.');
    }
  } else {
    if (current.data.size > 256000) throw new Error('Existing manifest too large.');
    manifest = JSON.parse(await current.data.text());
    parseModelManifest(manifest);
  }
  if (manifest.results.some(row => row.id === entry.id)) throw new Error('Result ID already exists. Use a new run ID.');
  const next = { ...manifest, results: [...manifest.results, entry] };
  parseModelManifest(next);
  const json = Buffer.from(JSON.stringify(next, null, 2));
  if (json.length > 256000) throw new Error('Updated manifest too large.');
  const image = await bucket.upload(entry.image_path, png, { contentType: 'image/png', upsert: false });
  if (image.error) throw new Error('PNG upload failed; manifest was not changed.');
  const list = await bucket.upload('results/manifest.json', json, { contentType: 'application/json', upsert: true });
  if (list.error) throw new Error('PNG uploaded but manifest update failed. Preserve the file and inspect before retrying.');
  return { id: entry.id, image_path: entry.image_path };
}

async function main() {
  const { values } = parseArgs({ options: { dir: { type: 'string' }, publish: { type: 'boolean', default: false } } });
  if (!values.dir) throw new Error('Usage: node tools/publish-model-result.mjs --dir ml-output/RUN_ID [--publish]');
  const entry = JSON.parse((await fs.readFile(path.join(values.dir, 'manifest.entry.json'), 'utf8')).replace(/^\uFEFF/, ''));
  const png = await fs.readFile(path.join(values.dir, 'prediction.png'));
  parseModelManifest({ version: 1, results: [entry] });
  if (!values.publish) {
    console.log('Dry run only. Upload destination:', 'sarscope-data/' + entry.image_path);
    console.log('Use --publish to upload this actual model output and update the manifest.');
    return;
  }
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const result = await publishModelResult(getSupabaseServer(), entry, png);
  console.log('Published model result:', result.id);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
