import { defineConfig } from 'vite';

// Precarga el logo 3D desde el HTML, sin esperar a que main.js lo pida.
const preloadMetal = {
  name: 'preload-metal',
  transformIndexHtml: {
    order: 'post',
    handler(_, { bundle }) {
      const file = Object.keys(bundle ?? {}).find(f => /metal-.*\.js$/.test(f));
      return file ? [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${file}` }, injectTo: 'head-prepend' }] : [];
    },
  },
};

// Rutas relativas: funciona en GitHub Pages (/BALMES-CODE/) y en un dominio propio.
export default defineConfig({ base: './', plugins: [preloadMetal] });
