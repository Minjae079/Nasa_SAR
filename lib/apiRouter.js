import { GET as coverage } from '../api/coverage.js';
import { GET as preview } from '../api/preview.js';
import { GET as status } from '../api/database-status.js';
import { GET as results } from '../api/model-results.js';

const routes = new Map([
  ['/api/coverage', coverage], ['/api/preview', preview],
  ['/api/database-status', status], ['/api/model-results', results], ['/api/analyses', results],
]);

// Vite development/preview adapter; production still uses the same /api files.
export function apiMiddleware(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return next();
  const handler = routes.get(url.pathname);
  if (!handler) { res.writeHead(404); res.end('Not found'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return;
  }
  handler(new Request(url)).then(async response => {
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  }).catch(() => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end('{"error":"INTERNAL_SERVER_ERROR"}');
  });
}
