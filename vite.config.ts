import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      name: 'Gregory',
      fileName: (format) => (format === 'es' ? 'gregory.js' : 'gregory.umd.cjs'),
      formats: ['es', 'umd'],
      cssFileName: 'gregory',
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      include: ['src'],
      // Emits dist/index.d.ts next to per-module declarations. Bundling them
      // into one file needs @microsoft/api-extractor, which is not worth a
      // dependency at this size.
      insertTypesEntry: true,
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
})
