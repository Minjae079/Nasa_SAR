import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { apiMiddleware } from './lib/apiRouter.js';
import { demoMiddleware } from './lib/demoResults.js';
import fs from 'node:fs';
import path from 'node:path';

function privateSourceMiddleware(req, res, next) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (/^\/(lib|supabase|test|tools|ml|ml-output|demo-data)(\/|$)/.test(pathname) ||
      /\.(pt|pth|npz|npy|h5|hdf5)$/i.test(pathname) ||
      /^\/(vite\.config\.js|dev-server\.mjs)$/.test(pathname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  next();
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Server-only environment; Vite only exposes VITE_ variables to the client.
  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SARSCOPE_PUBLIC_ANALYSES']) {
    if (process.env[key] === undefined && env[key] !== undefined) process.env[key] = env[key];
  }
  return {
    plugins: [react(), {
      name: 'sarscope-api',
      configureServer(server) {
        server.middlewares.use(demoMiddleware());
        server.middlewares.use(apiMiddleware);
        server.middlewares.use(privateSourceMiddleware);
      },
      configurePreviewServer(server) { server.middlewares.use(apiMiddleware); },
      // Preserve optional real, user-prepared overlays without shipping API data,
      // model files, catalog exports, or any environment files in the web build.
      closeBundle() {
        const config = 'data/sar_layers.json';
        if (fs.existsSync(config)) {
          fs.mkdirSync('dist/data', { recursive: true });
          fs.copyFileSync(config, 'dist/data/sar_layers.json');
          const overlay = JSON.parse(fs.readFileSync(config, 'utf8'));
          for (const key of ['before_image', 'after_image']) {
            const file = overlay[key];
            if (typeof file !== 'string' || !/^assets\/[a-zA-Z0-9_./-]+\.(png|jpg|webp)$/.test(file) ||
                file.split('/').some(part => part.startsWith('.'))) continue;
            if (!fs.existsSync(file)) continue;
            const dest = path.join('dist', file);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(file, dest);
          }
        }
      },
    }],
    server: { host: '127.0.0.1', port: Number(process.env.PORT || 3000), strictPort: true,
      fs: { deny: ['.env', '.env.*', '**/.git/**', '**/supabase/**', '**/ml-output/**', '**/demo-data/**',
        '**/*.pt', '**/*.pth', '**/*.npz', '**/*.npy', '**/*.h5', '**/*.hdf5',
        path.resolve('lib').replaceAll('\\', '/') + '/**',
        path.resolve('api').replaceAll('\\', '/') + '/**'] } },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: { outDir: 'dist', sourcemap: false },
  };
});
