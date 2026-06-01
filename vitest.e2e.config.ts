import {mergeConfig, defineConfig} from 'vitest/config';
import viteConfig from './vite.config';

// End-to-end suite: route tests are colocated with the route files
// (src/routes/*.e2e.test.ts). A single dev server + in-memory PGlite database
// is booted once by globalSetup (see test/e2e/globalSetup.ts). Runs serially.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/routes/**/*.e2e.test.ts'],
      globalSetup: ['test/e2e/globalSetup.ts'],
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 120_000,
    },
  }),
);
