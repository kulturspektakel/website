import {defineConfig, loadEnv} from 'vite';
import {tanstackStart} from '@tanstack/react-start/plugin/vite';
import {nitroV2Plugin} from '@tanstack/nitro-v2-vite-plugin';
import {sentryTanstackStart} from '@sentry/tanstackstart-react/vite';
import viteReact from '@vitejs/plugin-react';

// Load `SENTRY_*` vars from `.env` (written by `yarn sync:env` before the CI
// build). `.env` is read regardless of mode, so a fixed mode is fine here — and
// keeping the config an object (not a function) lets the vitest configs
// `mergeConfig` it.
const env = loadEnv('production', process.cwd(), 'SENTRY');

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
      // workspace (~14 sequential paginated requests, ~7s) since the API has
      // no recency sort. That brushes Vercel's default function timeout and
      // intermittently 504s. Raise the ceiling (a max, billed by actual time).
      vercel: {
        functions: {
          maxDuration: 60,
        },
      },
    }),
    viteReact(),
    // Uploads source maps to Sentry. Auto-skips upload when no auth token is
    // present, so local/preview builds without SENTRY_AUTH_TOKEN are a no-op.
    sentryTanstackStart({
      org: 'kulturspektakel',
      project: 'website',
      authToken: env.SENTRY_AUTH_TOKEN,
    }),
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
