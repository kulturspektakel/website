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
      // These compile into `.vercel/output/config.json` *above* the
      // `filesystem` handle and the `/__fallback` catch-all, so they're
      // resolved at the edge and never reach the function.
      routeRules: {
        // Short marketing URLs printed on menus and signage. Answering them
        // here means the 307 — which never varies — costs no invocation, where
        // the route files' `beforeLoad` had to boot the SSR function to emit it.
        // src/routes/vegan.tsx and glutenfrei.tsx are kept as the `vite dev`
        // fallback (route rules are edge-only) and as the type-checked record of
        // these destinations; production never reaches them.
        '/vegan': {
          redirect: {to: '/speisekarte?filter=vegan', statusCode: 307},
        },
        '/glutenfrei': {
          redirect: {to: '/speisekarte?filter=glutenfrei', statusCode: 307},
        },
        // Vite's content-hashed output: the hash changes whenever the bytes do,
        // so these are safe to pin forever. Without this they went out as
        // `max-age=0, must-revalidate` and every repeat visit revalidated every
        // chunk.
        '/assets/**': {
          headers: {
            'cache-control': 'public, max-age=31536000, immutable',
          },
        },
        // `public/` files, served as-is under their own names. Not hashed, so a
        // moderate TTL rather than `immutable` — a replaced logo or updated
        // font stylesheet still rolls out within the day.
        '/styles/**': {
          headers: {'cache-control': 'public, max-age=600, s-maxage=86400'},
        },
        '/logos/**': {
          headers: {'cache-control': 'public, max-age=600, s-maxage=86400'},
        },
        '/genre/**': {
          headers: {'cache-control': 'public, max-age=600, s-maxage=86400'},
        },
        '/maizzle/**': {
          headers: {'cache-control': 'public, max-age=600, s-maxage=86400'},
        },
        '/marker.png': {
          headers: {'cache-control': 'public, max-age=600, s-maxage=86400'},
        },
        '/fallback.svg': {
          headers: {'cache-control': 'public, max-age=600, s-maxage=86400'},
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
