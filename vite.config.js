import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';

export default defineConfig({
  base: '/',
  root: fs.realpathSync(process.cwd()),
  build: {
    rollupOptions: {
      external: [
        '@tauri-apps/api/core',
        '@tauri-apps/plugin-updater',
        '@tauri-apps/plugin-process'
      ]
    }
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3000,
    host: true,
    watch: {
      ignored: [
        /\.apk$/i,
        '**/*.apk',
        '*.apk',
        '**/android/**',
        '**/.git/**'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  }
});
