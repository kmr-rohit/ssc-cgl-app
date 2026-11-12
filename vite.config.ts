import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: true, port: 5173 },
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tools/**/*.test.ts'], exclude: ['e2e/**', 'node_modules/**'] },
} as any);
