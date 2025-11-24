// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite Configuration for Budget Analyzer Web
 *
 * Development flow (HTTPS):
 * 1. Vite dev server runs on port 3000 (hot reload)
 * 2. Browser accesses app via https://app.budgetanalyzer.localhost
 * 3. NGINX (port 443) terminates SSL and proxies to Session Gateway (8081)
 * 4. Session Gateway proxies frontend requests to NGINX → Vite (3000)
 *
 * API request flow:
 * Browser → NGINX (443) → Session Gateway (8081) → NGINX API (api.budgetanalyzer.localhost) → Backend services
 *
 * Production:
 * - Vite builds static files to dist/
 * - NGINX serves static files directly
 * - Session Gateway proxies to NGINX
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow Docker to access the dev server
    strictPort: true,
    allowedHosts: true, // Allow all hosts (needed for Docker/NGINX proxy access)
    watch: {
      // Use polling for Docker/Kubernetes file watching
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      // Connect HMR WebSocket directly to port-forwarded Vite server
      // This bypasses the proxy chain for reliable hot reload
      host: 'localhost',
      port: 3000,
      protocol: 'ws',
    },
    // Note: In dev, access the app via https://app.budgetanalyzer.localhost (NGINX → Session Gateway)
    // not http://localhost:3000 (Vite dev server directly)
  },
});