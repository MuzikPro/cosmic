import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';
import { existsSync } from 'node:fs';

// 本地壁纸构建（Wallpaper Engine / Lively，file:// 运行）：npm run build:wallpaper → base './'，产物在 dist-wallpaper/
const wallpaper = process.env.VITE_WALLPAPER === '1';

export default defineConfig({
  base: wallpaper ? './' : '/',
  build: wallpaper ? { outDir: 'dist-wallpaper', emptyOutDir: true } : undefined,
  // legacy: Vite 默认产物要求 Safari 14+，旧 iPad(iPadOS ≤13) 解析失败=白屏。
  // 转译 + polyfill 到 iOS/Safari 12；WebGL2(三维引擎硬要求)另在 index.html 显式提示。
  plugins: [react(), legacy({ targets: ['defaults', 'iOS >= 12', 'Safari >= 12'] })],
  server: {
    port: 5177,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 开源核心：私有音色包在构建期覆盖到 src/audio/pack/（gitignored）；缺席时用参考音色包
      '@pack': fileURLToPath(new URL(existsSync(fileURLToPath(new URL('./src/audio/pack/index.ts', import.meta.url))) ? './src/audio/pack' : './src/audio/fallback', import.meta.url))
    }
  }
});
