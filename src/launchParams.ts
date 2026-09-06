/**
 * 启动参数（cosmic 专有，owner 2026-09-05）：让宿主（macOS .saver、壁纸宿主、信息屏 kiosk）用 URL 查询串
 * 预设屏保设置，例如 ?sound=1&autoplay=1&volume=20&overlay=OFF&mode=combined&flow=0.1&saver=1&lang=zh
 * 只在有参数时改写已存设置并保存；无参数 ＝ 原样。
 */
import { ALL_MERIDIANS, loadSettings, saveSettings, ScreensaverSettings } from './components/Screensaver/screensaverSettings';
import { TWELVE } from './components/Acupoints/pointGeometry';
import { setLang } from './i18n';

export function applyLaunchParams(search: string = typeof location !== 'undefined' ? location.search : ''): void {
  const q = new URLSearchParams(search);
  if ([...q.keys()].length === 0) return;
  const s: ScreensaverSettings = loadSettings();
  let changed = false;
  const num = (k: string, lo: number, hi: number): number | null => {
    if (!q.has(k)) return null;
    const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
  };
  const flag = (k: string): boolean | null => (q.has(k) ? ['1', 'true', 'on'].includes((q.get(k) ?? '').toLowerCase()) : null);
  const oneOf = <T extends string>(k: string, allowed: readonly T[]): T | null => {
    const v = q.get(k); return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  };
  const mode = oneOf('mode', ['cameraOrbit', 'bodyRotation', 'combined'] as const); if (mode) { s.mode = mode; changed = true; }
  const flow = num('flow', 0.05, 1); if (flow !== null) { s.flowSpeed = flow; changed = true; }
  const opacity = num('opacity', 0.05, 0.6); if (opacity !== null) { s.bodyOpacity = opacity; changed = true; }
  const calm = oneOf('calm', ['auto', 'on', 'off'] as const); if (calm) { s.reducedMotion = calm; changed = true; }
  const power = oneOf('power', ['auto', 'on', 'off'] as const); if (power) { s.powerSaver = power; changed = true; }
  const vessels = flag('vessels'); if (vessels !== null) { s.visible = vessels ? ALL_MERIDIANS : TWELVE; changed = true; }
  const sound = flag('sound'); if (sound !== null) { s.temporal = { ...s.temporal, enabled: sound }; changed = true; }
  const volume = num('volume', 0, 70); if (volume !== null) { s.temporal = { ...s.temporal, masterVolume: volume / 100 }; changed = true; }
  const overlay = oneOf('overlay', ['OFF', 'MINIMAL', 'DETAILED'] as const); if (overlay) { s.temporal = { ...s.temporal, overlay }; changed = true; }
  const lang = oneOf('lang', ['en', 'zh'] as const); if (lang) setLang(lang);
  if (changed) saveSettings(s);
}
