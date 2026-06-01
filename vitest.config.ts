import {mergeConfig, defineConfig, configDefaults} from 'vitest/config';
import viteConfig from './vite.config';

// Default (unit) test run: excludes the heavy e2e suite, which boots a real
// server + database and runs via vitest.e2e.config.ts instead.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, '**/*.e2e.test.ts'],
    },
  }),
);
