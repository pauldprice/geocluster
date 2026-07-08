/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build produces a single self-contained dist/index.html (JS, CSS, and the
// zone GeoJSON all inlined) so the app runs from file:// or a USB stick
// during field deployments. Live feeds still require a network, of course.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    chunkSizeWarningLimit: 8000
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
