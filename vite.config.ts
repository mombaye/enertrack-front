// vite.config.ts ou vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { writeFileSync, mkdirSync } from 'fs';

// Identifiant de version propre à chaque build : l'application compare sa version à /version.json (jamais mis en cache)
// et se met à jour toute seule dès qu'un déploiement est détecté.
const BUILD_ID = process.env.BUILD_ID || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'egrid-version-file',
      apply: 'build',
      closeBundle() {
        mkdirSync('dist', { recursive: true });
        writeFileSync('dist/version.json', JSON.stringify({ build: BUILD_ID }));
      },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts', // 👈 important
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
