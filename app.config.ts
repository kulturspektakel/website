import {defineConfig} from '@tanstack/react-start/config';
import tsConfigPaths from 'vite-tsconfig-paths';
import {wrapVinxiConfigWithSentry} from '@sentry/tanstackstart-react';
import {sentryVitePlugin} from '@sentry/vite-plugin';

const config = defineConfig({
  vite: {
    plugins: [
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: 'kulturspektakel',
        project: 'website',
      }),
    ],
    resolve: {
      alias: {
        '.prisma/client/index-browser':
          './node_modules/.prisma/client/index-browser.js',
      },
    },
    ssr: {
      noExternal: ['@apollo/client', 'iban-ts'],
    },
    build: {
      sourcemap: true,
    },
  },
  server: {
    preset: 'vercel',
  },
});

export default wrapVinxiConfigWithSentry(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Only print logs for uploading source maps in CI
  // Set to `true` to suppress logs
  silent: !process.env.CI,
});
