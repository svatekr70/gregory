import { defineConfig } from 'vite'

/**
 * Konfigurace projektového webu (site/). Stránky importují knihovnu přímo ze
 * `src/`, takže demo vždy ukazuje aktuální kód, ne poslední build.
 */
export default defineConfig({
  root: 'site',
  base: './',
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: new URL('site/index.html', import.meta.url).pathname,
        demo: new URL('site/demo/index.html', import.meta.url).pathname,
        guide: new URL('site/guide/index.html', import.meta.url).pathname,
        api: new URL('site/api/index.html', import.meta.url).pathname,
      },
    },
  },
})
