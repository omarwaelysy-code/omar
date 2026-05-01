import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist-server',
  clean: true,
  bundle: true,
  noExternal: [/^@?[\w-]+/], // Bundle everything to make it self-contained if needed, but for node we usually don't.
});
