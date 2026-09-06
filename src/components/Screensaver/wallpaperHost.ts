/**
 * 本地壁纸宿主桥接（owner 2026-09-05）：Wallpaper Engine / Lively 以 file:// 载入构建产物时，
 * 通过它们的属性回调把用户在宿主里调的选项映射到屏保设置；并标记"无手势也可尝试起音"。
 * 只在 VITE_WALLPAPER=1 的构建里激活（普通网页构建为 no-op）。
 */
import type { ScreensaverSettings } from './screensaverSettings';

export const IS_WALLPAPER_BUILD = import.meta.env.VITE_WALLPAPER === '1';
/** 由原生屏保宿主承载（?saver=1）：宿主掌管生命周期与可见性——页面不因 visibilitychange 停声，
 *  渲染循环改由定时器驱动（宿主里 WebKit 可能判定页面不可见而停掉 requestAnimationFrame） */
export const HOSTED_BY_SAVER = typeof location !== 'undefined' && new URLSearchParams(location.search).get('saver') === '1';
/** 无手势也尝试起音：壁纸构建，或宿主用 ?autoplay=1 声明它允许自动播放（macOS .saver、kiosk） */
export const AUTOPLAY_REQUESTED = IS_WALLPAPER_BUILD ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).get('autoplay') === '1');

type Patch = (fn: (d: ScreensaverSettings) => ScreensaverSettings) => void;

/** Wallpaper Engine: window.wallpaperPropertyListener.applyUserProperties({ key: { value } }) */
interface WEProps { [k: string]: { value: unknown } | undefined }

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;

export function installWallpaperHost(patch: Patch): () => void {
  if (!IS_WALLPAPER_BUILD || typeof window === 'undefined') return () => undefined;
  const w = window as unknown as {
    wallpaperPropertyListener?: { applyUserProperties?: (p: WEProps) => void };
    livelyPropertyListener?: (name: string, value: unknown) => void;
  };
  const apply = (name: string, value: unknown) => {
    switch (name) {
      case 'flowspeed': { const v = num(value, 5, 100); if (v !== null) patch((d) => ({ ...d, flowSpeed: v / 100 })); break; }
      case 'bodyopacity': { const v = num(value, 5, 60); if (v !== null) patch((d) => ({ ...d, bodyOpacity: v / 100 })); break; }
      case 'viewmode': { if (value === 'cameraOrbit' || value === 'bodyRotation' || value === 'combined') patch((d) => ({ ...d, mode: value })); break; }
      case 'sound': { if (typeof value === 'boolean') patch((d) => ({ ...d, temporal: { ...d.temporal, enabled: value } })); break; }
      case 'volume': { const v = num(value, 0, 70); if (v !== null) patch((d) => ({ ...d, temporal: { ...d.temporal, masterVolume: v / 100 } })); break; }
      case 'overlay': { if (value === 'OFF' || value === 'MINIMAL' || value === 'DETAILED') patch((d) => ({ ...d, temporal: { ...d.temporal, overlay: value } })); break; }
      case 'powersaver': { if (typeof value === 'boolean') patch((d) => ({ ...d, powerSaver: value ? 'on' : 'auto' })); break; }
      default: break;
    }
  };
  w.wallpaperPropertyListener = {
    applyUserProperties: (props) => { for (const [k, v] of Object.entries(props)) if (v) apply(k, v.value); }
  };
  w.livelyPropertyListener = (name, value) => apply(name, value);
  return () => { delete w.wallpaperPropertyListener; delete w.livelyPropertyListener; };
}
