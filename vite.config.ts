import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

// 本地壁纸 / 屏保离线构建（Wallpaper Engine、Lively、macOS .saver 以 file:// 运行）：
//   npm run build:wallpaper → base './'，产物在 dist-wallpaper/。
// file:// 下 ES module 脚本与 fetch() 都被同源策略拦下（WebKit 与 Chromium 皆然），所以：
//   ① 只出一个经典 IIFE 脚本，并把 index.html 里的 type="module" / crossorigin 去掉（file:// 下这两者都会被拦）
//   ② 人体网格以 data: URL 注入（VITE_BODY_MODEL_URL，见引擎 BodyMesh），不走 fetch
const wallpaper = process.env.VITE_WALLPAPER === '1';
const glbDataUrl = (file: string) =>
  `data:model/gltf-binary;base64,${readFileSync(fileURLToPath(new URL(`./public/models/${file}`, import.meta.url))).toString('base64')}`;

export default defineConfig({
  base: wallpaper ? './' : '/',
  build: wallpaper
    ? {
        outDir: 'dist-wallpaper', emptyOutDir: true, modulePreload: false, target: 'es2020',
        rollupOptions: { output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'assets/app.js', assetFileNames: 'assets/[name][extname]' } }
      }
    : undefined,
  define: wallpaper ? { 'import.meta.env.VITE_BODY_MODEL_URL': JSON.stringify(glbDataUrl('body-skin.glb')) } : undefined,
  // legacy: Vite 默认产物要求 Safari 14+，旧 iPad(iPadOS ≤13) 解析失败=白屏。
  // 转译 + polyfill 到 iOS/Safari 12；WebGL2(三维引擎硬要求)另在 index.html 显式提示。
  plugins: [
    react(),
    wallpaper
      ? {
          name: 'cosmic-classic-script',
          transformIndexHtml: { order: 'post' as const, handler: (html: string) => html
            .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
            .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=') }
        }
      : legacy({ targets: ['defaults', 'iOS >= 12', 'Safari >= 12'] })
  ],
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
