import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';

export default defineConfig({
  root: fs.realpathSync(process.cwd()),
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
