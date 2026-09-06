import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const pack = existsSync(fileURLToPath(new URL('./src/audio/pack/index.ts', import.meta.url)));
export default defineConfig({
  resolve: { alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    '@pack': fileURLToPath(new URL(pack ? './src/audio/pack' : './src/audio/fallback', import.meta.url))
  } },
  // 私有音色包自带测试（src/audio/pack/*.test.ts），在本地有包时一起跑
  test: { environment: 'node', include: ['test/**/*.test.ts', 'src/audio/pack/**/*.test.ts'] }
});
