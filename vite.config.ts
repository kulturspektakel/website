import {defineConfig} from 'vite';
import {tanstackStart} from '@tanstack/react-start/plugin/vite';
import {nitroV2Plugin} from '@tanstack/nitro-v2-vite-plugin';
import viteReact from '@vitejs/plugin-react';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      // Tests are colocated with route files; don't treat them as routes.
      router: {
        routeFileIgnorePattern: '\\.(test|spec)\\.',
      },
    }),
    nitroV2Plugin({
      preset: 'vercel',
      // The /api/tasks/nuclino-update-message cron scans the whole Nuclino
      // workspace (~14 sequential paginated requests, ~7s) since the API has no
      // recency sort. That brushes Vercel's default function timeout and
      // intermittently 504s. Raise the ceiling (a max, billed by actual time).
      vercel: {
        functions: {
          maxDuration: 60,
        },
      },
    }),
    viteReact(),
  ],
  ssr: {
    noExternal: ['@apollo/client', 'iban-ts'],
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['daniels-mac-studio.local'],
  },
});
