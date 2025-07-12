import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.', // 项目根即 html 所在目录
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'pages/assets': resolve(__dirname, 'pages/assets.html'),
        'pages/planning': resolve(__dirname, 'pages/planning.html'),
        'pages/management': resolve(__dirname, 'pages/management.html')
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  }
}); 