import { defineConfig } from 'vite';

// `vite build --mode single` (npm run build:single) inlines every asset so tools/inline-html.mjs can
// fold the result into one self-contained HTML file for hosts that take a single page.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? () => true : 0,
      chunkSizeWarningLimit: single ? 20000 : 1600,
      // Phaser changes rarely: its own chunk stays cached across game updates.
      rollupOptions: single ? {} : { output: { manualChunks: { phaser: ['phaser'] } } },
    },
  };
});
