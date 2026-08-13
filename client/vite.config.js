import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    fs: { allow: ['..'] } // needed to import shared/gameConfig.js from outside client/
  },
  build: { outDir: 'dist' }
});
