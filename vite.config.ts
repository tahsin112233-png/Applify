import { defineConfig, PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import solidPlugin from 'vite-plugin-solid';
import autoprefixer from 'autoprefixer';
import postcssJitProps from 'postcss-jit-props';
import OpenProps from 'open-props';
import { resolve } from 'path';
import { readdirSync } from 'fs';
import path from 'path';


export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    Locales: readdirSync(resolve(__dirname, './src/locales')).map(file => file.slice(0, 2)),
    Build: JSON.stringify('v' + require('./package.json').version),
  },
  resolve: {
    alias: {
      '@stores': path.resolve(__dirname, './src/lib/stores'),
      '@modules': path.resolve(__dirname, './src/lib/modules'),
      '@utils': path.resolve(__dirname, './src/lib/utils'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
    },
  },
  plugins: [
    solidPlugin(),
    injectEruda(command === 'serve'),
    apiMiddleware(command === 'serve'),
    VitePWA({
      manifest: {
        "short_name": "Applify",
        "name": "Applify — Beautiful Music",
        "description": "Stream YouTube audio with a beautiful Apple Music-inspired interface. Free, fast, and works in your browser.",
        "icons": [
          {
            "src": "logo192.png",
            "type": "image/png",
            "sizes": "192x192",
            "purpose": "any maskable"
          },
          {
            "src": "logo512.png",
            "type": "image/png",
            "sizes": "512x512",
            "purpose": "any maskable"
          },
          {
            "src": "monochrome.png",
            "type": "image/png",
            "sizes": "512x512",
            "purpose": "monochrome"
          },
          {
            "src": "logo512.png",
            "type": "image/png",
            "sizes": "44x44",
            "purpose": "any"
          }
        ],
        "shortcuts": [
          {
            "name": "History",
            "url": "/?collection=history",
            "icons": [{ "src": "memories-fill.png", "sizes": "192x192" }]
          },
          {
            "name": "Favorites",
            "url": "/?collection=favorites",
            "icons": [{ "src": "heart-fill.png", "sizes": "192x192" }]
          },
          {
            "name": "Listen Later",
            "url": "/?collection=listenLater",
            "icons": [{ "src": "calendar-schedule-fill.png", "sizes": "192x192" }]
          }
        ],
        "start_url": "/",
        "display": "standalone",
        "theme_color": "#000000",
        "background_color": "#000000",
        "share_target": {
          "action": "/",
          "method": "GET",
          "params": {
            "title": "title",
            "text": "text",
            "url": "url"
          }
        }
      },
      disable: true,
      includeAssets: ['*.woff2', 'ytify_banner.webp']
    })
  ],
  css: {
    postcss: {
      plugins: [
        autoprefixer(),
        postcssJitProps(OpenProps)
      ]
    }
  }
}));


const injectEruda = (serve: boolean) => serve ? (<PluginOption>{
  name: 'erudaInjector',
  transformIndexHtml: html => ({
    html,
    tags: [
      {
        tag: 'script',
        attrs: { src: '/node_modules/eruda/eruda' },
        injectTo: 'body-prepend'
      },
      {
        tag: 'script',
        injectTo: 'body-prepend',
        children: 'eruda.init()'
      }
    ]
  })
}) : [];

const apiMiddleware = (serve: boolean): PluginOption => serve ? {
  name: 'api-middleware',
  configureServer(server) {
    const endpoints = ['album', 'artist', 'channel', 'gallery', 'playlist', 'search', 'search-suggestions', 'similar', 'subfeed'];
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '', 'http://localhost');
      const path = url.pathname.replace(/^\/api\//, '').replace(/^\//, '');

      if (endpoints.includes(path) || req.url?.startsWith('/api/')) {
        const { createLocalAdapter } = await server.ssrLoadModule('./src/backend/localAdapter.ts');
        const adapter = createLocalAdapter();
        return adapter(req, res);
      } else {
        next();
      }
    });
  }
} : [];
