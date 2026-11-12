import { defineConfig } from 'vite';

const healthRoute = server => { server.middlewares.use((req, res, next) => {
  if (/^\/serverhealth\/?(?:\?.*)?$/.test(req.url || '')) req.url = '/serverhealth/index.html';
  next();
}); };

export default defineConfig({
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
});
