import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    // Phaser changes rarely: its own chunk stays cached across game updates.
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
