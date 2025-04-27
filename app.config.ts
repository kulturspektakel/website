import {defineConfig} from '@tanstack/react-start/config';
import tsConfigPaths from 'vite-tsconfig-paths';
import {wrapVinxiConfigWithSentry} from '@sentry/tanstackstart-react';

const config = defineConfig({
  vite: {
    plugins: [
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
    ],
    ssr: {
      noExternal: ['@apollo/client', 'iban-ts'],
    },
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
