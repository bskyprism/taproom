// @ts-check
import { defineConfig } from 'vite'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        global: 'globalThis'
    },
    plugins: [
        preact({
            devtoolsInProd: false,
            prefreshEnabled: true,
        })
    ],
    // https://github.com/vitejs/vite/issues/8644#issuecomment-1159308803
    esbuild: {
        logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    publicDir: '_public',
    css: {
        transformer: 'lightningcss',
        lightningcss: {
            targets: browserslistToTargets(browserslist('>= 0.25%')),
        },
    },
    server: {
        port: 8888,
        host: true,
        open: true,
        proxy: {
            '/api': {
                target: 'http://localhost:9999/.netlify/functions',
                changeOrigin: true,
                rewrite: path => path.replace(/^\/api/, ''),
            },
        },
    },
    build: {
        cssMinify: 'lightningcss',
        target: 'esnext',
        minify: false,
        outDir: './public',
        emptyOutDir: true,
        sourcemap: 'inline'
    }
})
