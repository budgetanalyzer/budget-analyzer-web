// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testing/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/features/**/types/**',
        'src/main.tsx',
        'src/testing/**',
        'src/types/{auth,currency,session,statementFormat,transaction,transactionSearch,user,view}.ts',
        '*.config.{ts,js}',
        '.*rc.{ts,js}',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 75,
        lines: 80,
      },
    },
    env: {
      TZ: 'America/Los_Angeles',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
