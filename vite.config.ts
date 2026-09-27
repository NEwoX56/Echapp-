import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  }
});
