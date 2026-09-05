import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // legacy: Vite 默认产物要求 Safari 14+，旧 iPad(iPadOS ≤13) 解析失败=白屏。
  // 转译 + polyfill 到 iOS/Safari 12；WebGL2(三维引擎硬要求)另在 index.html 显式提示。
  plugins: [react(), legacy({ targets: ['defaults', 'iOS >= 12', 'Safari >= 12'] })],
  server: {
    port: 5177,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
