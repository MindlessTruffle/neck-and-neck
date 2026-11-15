import { defineConfig } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

function assetRevisions() {
  const revisions = {};
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(glb|png|jpg|webp|mp3|ogg|wav)$/.test(path)) revisions[relative('public', path).replaceAll('\\', '/')] = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
    }
  }
  walk('public');
  return revisions;
}

const healthRoute = server => { server.middlewares.use((req, res, next) => {
  if (/^\/serverhealth\/?(?:\?.*)?$/.test(req.url || '')) req.url = '/serverhealth/index.html';
  next();
}); };

export default defineConfig(({ command }) => ({
  define: { __ASSET_REVISIONS__: JSON.stringify(command === 'build' ? assetRevisions() : {}) },
  base: './',
  plugins: [{ name: 'server-health-route', configureServer: healthRoute, configurePreviewServer: healthRoute }],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], react: ['react', 'react-dom/client'] },
      },
    },
    chunkSizeWarningLimit: 650,
  },
}));
