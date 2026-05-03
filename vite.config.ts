import { defineConfig, type Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function pixiUnsafeEvalPlugin(): Plugin {
  return {
    name: 'pixi-unsafe-eval-patch',
    writeBundle(options) {
      const outDir = options.dir || 'minigame';
      const bundlePath = path.resolve(outDir, 'game-bundle.js');

      if (!fs.existsSync(bundlePath)) {
        return;
      }

      const code = fs.readFileSync(bundlePath, 'utf8');
      const pattern = /systemCheck\(\)\{if\(!\w+\(\)\)throw new Error\("Current environment does not allow unsafe-eval[^}]*\}/g;
      const patched = code.replace(pattern, 'systemCheck(){}');

      if (patched !== code) {
        fs.writeFileSync(bundlePath, patched, 'utf8');
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['@pixi/core', '@pixi/display', '@pixi/settings', '@pixi/constants', '@pixi/utils'],
  },
  publicDir: false,
  plugins: [pixiUnsafeEvalPlugin()],
  build: {
    outDir: 'minigame',
    assetsInlineLimit: 0,
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      formats: ['iife'],
      name: 'HotPot',
      fileName: () => 'game-bundle.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild',
    emptyOutDir: false,
  },
});
