// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy API requests during development
      '/api': {
        target: 'http://localhost:8080/budget-analyzer-api',
        changeOrigin: true,
        secure: false,
        // optional: rewrite "/api" prefix if backend doesn’t expect it
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  }
});