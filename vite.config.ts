import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** After build: stamp dist/sw.js with a version + the list of every file to precache. */
function pwaPrecache(): Plugin {
  return {
    name: 'pwa-precache',
    apply: 'build',
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const files: string[] = [];
      const walk = (d: string) => readdirSync(d).forEach((n) => { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); });
      walk(dist);
      const urls = files.map((f) => '/' + relative(dist, f).split('\\').join('/'))
        .filter((u) => u !== '/sw.js' && !u.endsWith('.map') && !u.endsWith('.DS_Store'))
        .map((u) => (u === '/index.html' ? '/' : u)).sort();
      const hash = createHash('sha256');
      files.filter((f) => !f.endsWith('sw.js')).sort().forEach((f) => hash.update(readFileSync(f)));
      const version = hash.digest('hex').slice(0, 12);
      const sw = join(dist, 'sw.js');
      const out = readFileSync(sw, 'utf8')
        .replace("const VERSION = '__VERSION__';", `const VERSION = ${JSON.stringify(version)};`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(urls)};`);
      if (out.includes('__VERSION__') || out.includes('__PRECACHE__')) throw new Error('pwa-precache: placeholders left in sw.js');
      writeFileSync(sw, out);
      console.log(`pwa-precache: ${urls.length} files, version ${version}`);
    },
  };
}

export default defineConfig({
  plugins: [pwaPrecache()],
  server: { host: true, port: 5173 },
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tools/**/*.test.ts'], exclude: ['e2e/**', 'node_modules/**', '**/*.int.test.ts'] },
} as never);
