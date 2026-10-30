import { build } from 'esbuild';

// These bundles are committed so the static site runs without a build server.
await build({
  stdin: {
    contents: "export {createClient} from '@supabase/supabase-js';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  legalComments: 'eof',
  outfile: 'js/arcade-platform/vendor.js',
});

// The shared validator imports pure physics and math, without the renderer.
await build({
  entryPoints: ['games/shared/services/golf-validator.js'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: 'supabase/functions/arcade-api/golf-validator.js',
});
