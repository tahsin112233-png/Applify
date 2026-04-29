import { defineConfig, PluginOption } from 'vite';
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
