import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    chunkSizeWarningLimit: 2500,
    assetsInlineLimit: 4096,
    target: 'es2020'
  }
});
