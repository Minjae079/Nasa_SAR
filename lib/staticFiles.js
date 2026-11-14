import path from 'node:path';
// Only website assets may be served from a workspace containing server secrets.
export function isPublicFile(requested) {
  const parts = requested.split('/').filter(Boolean);
  if (parts.some(part => part.startsWith('.') || part.includes('\\') || part.includes(':'))) return false;
  if (parts.length === 1) return new Set(['index.html', 'app.js', 'database-status.js', 'model-results.js', 'styles.css',
    'responsive.css', 'compare.css', 'map.css', 'sky.css', 'favicon.ico']).has(parts[0]);
  if (requested === '/data/sar_layers.json') return true;
  return parts[0] === 'assets' && new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'])
    .has(path.extname(requested).toLowerCase());
}
