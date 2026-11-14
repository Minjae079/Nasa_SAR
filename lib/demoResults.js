import fs from 'node:fs/promises';
import path from 'node:path';

// Registered only by Vite's development server, never by /api Vercel functions.
export function demoMiddleware(root = path.resolve('demo-data')) {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!['/api/demo-results', '/api/demo-image'].includes(url.pathname)) return next();
    if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return; }
    try {
      const raw = await fs.readFile(path.join(root, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(raw);
      if (manifest.synthetic !== true || !Array.isArray(manifest.results)) throw new Error();
      if (url.pathname === '/api/demo-results') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ state: 'demo', synthetic: true, results: manifest.results.map(
          ({ image_file, image_path, ...row }) => ({ ...row, is_demo: true,
            image_url: `/api/demo-image?id=${encodeURIComponent(row.id)}` })) }));
        return;
      }
      const row = manifest.results.find(item => item.id === url.searchParams.get('id'));
      if (!row || !/^demo-[a-f0-9]{8}\/(input|reference|prediction)\.png$/.test(row.image_file)) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const image = await fs.readFile(path.join(root, row.image_file));
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); res.end(image);
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"error":"DEMO_NOT_GENERATED"}');
    }
  };
}
