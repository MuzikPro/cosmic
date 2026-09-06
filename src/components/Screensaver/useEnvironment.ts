import { useEffect, useState } from 'react';

/**
 * 环境探测（owner 2026-09-05）：系统"减少动态效果"偏好 与 电池状态。
 * 电池 API 只有 Chromium 有；没有时视为"不在用电池"。不上传、不记录。
 */
export interface EnvironmentState {
  prefersReducedMotion: boolean;
  onBattery: boolean;        // 有电池且未充电
  batteryLevel: number | null;
}

type BatteryLike = { charging: boolean; level: number; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };

export function useEnvironment(): EnvironmentState {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [battery, setBattery] = useState<{ onBattery: boolean; level: number | null }>({ onBattery: false, level: null });
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (!nav.getBattery) return;
    let b: BatteryLike | null = null;
    const sync = () => { if (b) setBattery({ onBattery: !b.charging, level: b.level }); };
    nav.getBattery().then((bat) => { b = bat; sync(); bat.addEventListener('chargingchange', sync); bat.addEventListener('levelchange', sync); }).catch(() => undefined);
    return () => { b?.removeEventListener('chargingchange', sync); b?.removeEventListener('levelchange', sync); };
  }, []);
  return { prefersReducedMotion: reduced, onBattery: battery.onBattery, batteryLevel: battery.level };
}
