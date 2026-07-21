import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: resolve(__dirname),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4100', changeOrigin: true },
      '/agents': { target: 'http://127.0.0.1:4100', changeOrigin: true },
      '/webhooks': { target: 'http://127.0.0.1:4100', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:4100', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:4100', ws: true, changeOrigin: true },
      '/wa.html': { target: 'http://127.0.0.1:4100', changeOrigin: true },
    },
  },
});
