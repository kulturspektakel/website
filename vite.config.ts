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

// `public/` files, served as-is under their own names. Not hashed, so a moderate
// TTL rather than `immutable` — a replaced logo or updated font stylesheet still
// rolls out within the day. Without an entry a file goes out as
// `max-age=0, must-revalidate` and is revalidated on every repeat visit.
const PUBLIC_CACHE = {
  'cache-control': 'public, max-age=600, s-maxage=86400',
};

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
        // Same, but off-site — and unlike the two above it had no
        // `Cache-Control` at all, since a `beforeLoad` redirect never reaches
        // the `_main` loader that sets one.
        '/learn': {
          redirect: {to: 'https://youtu.be/EakoNs1PP1c', statusCode: 307},
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
        // See PUBLIC_CACHE above for why these get a TTL at all.
        '/styles/**': {headers: PUBLIC_CACHE},
        '/logos/**': {headers: PUBLIC_CACHE},
        '/genre/**': {headers: PUBLIC_CACHE},
        '/maizzle/**': {headers: PUBLIC_CACHE},
        '/marker.png': {headers: PUBLIC_CACHE},
        '/fallback.svg': {headers: PUBLIC_CACHE},
        '/robots.txt': {headers: PUBLIC_CACHE},
        '/favicon.ico': {headers: PUBLIC_CACHE},
        '/apple-touch-icon.png': {headers: PUBLIC_CACHE},
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
    // Everything not listed here stays external, i.e. `require`d out of the
    // function's own `node_modules` at runtime — the whole package is parsed on
    // every cold start with no tree-shaking. Cold starts dominate this
    // function's billed CPU, so barrel-shaped packages belong here: bundling
    // lets Vite shake them down to the exports actually used. `@chakra-ui/react`
    // + `date-fns` roughly halved cold start, and Chakra's own dependency tree
    // (`@ark-ui/react`, the ~74 `@zag-js/*` packages) had to follow — bundling
    // the wrapper alone left the actual payload external.
    //
    // Pick candidates by *measuring*, not by package size. `react-icons`,
    // `zod`, `formik`, `downshift` and `markdown-to-jsx` were all tried here and
    // reverted: no measurable change, because V8 compiles function bodies
    // lazily, so a 1.7 MB file of icon factory calls evaluates in ~20 ms. To
    // measure, import a package on its own inside `.vercel/output/functions/
    // __fallback.func` and diff `process.cpuUsage()`.
    noExternal: [
      'iban-ts',
      '@chakra-ui/react',
      'date-fns',
      '@ark-ui/react',
      /^@zag-js\//,
      /^@internationalized\//,
      '@pandacss/is-valid-prop',
    ],
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
