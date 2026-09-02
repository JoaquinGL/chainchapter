import { build } from 'esbuild';
await build({ entryPoints: ['src/extension/background.ts'], outfile: 'dist/background.js', bundle: true, format: 'esm', target: 'chrome120' });
await build({ entryPoints: ['src/extension/content.ts'], outfile: 'dist/content.js', bundle: true, format: 'iife', target: 'chrome120' });
