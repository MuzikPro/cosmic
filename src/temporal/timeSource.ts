/**
 * 时间来源：真实本地时间 / 手动时辰 / 压缩的 24 小时预览。
 * 预览加速只在 PREVIEW 模式存在；LOCAL_REAL_TIME 永远读系统时钟，不上传任何时间数据。
 */
import { slotStartSeconds } from './shichen';
import type { TimeSource } from './types';

export interface VirtualClockConfig {
  source: TimeSource;
  manualIndex?: number;          // MANUAL_SHICHEN
  previewCycleMinutes?: number;  // PREVIEW_24H_CYCLE
}

export interface VirtualClock {
  readonly source: TimeSource;
  now(): Date;
}

export function createVirtualClock(cfg: VirtualClockConfig, realNow: () => number = Date.now): VirtualClock {
  switch (cfg.source) {
    case 'MANUAL_SHICHEN': {
      // 固定在所选时辰正中（进度 0.5，满权重），日期取今天
      const idx = ((cfg.manualIndex ?? 0) % 12 + 12) % 12;
      return {
        source: cfg.source,
        now: () => {
          const d = new Date(realNow());
          const mid = slotStartSeconds(idx) + 3600;
          d.setHours(Math.floor(mid / 3600) % 24, 0, 0, 0);
          return d;
        }
      };
    }
    case 'PREVIEW_24H_CYCLE': {
      // 从开启预览的真实时刻起，以 1440/分钟数 的倍速前进；休眠后虚拟时间照样跳过（预览无需追赶）
      const minutes = Math.max(1, Math.min(60, cfg.previewCycleMinutes ?? 12));
      const rate = 1440 / minutes;
      const anchor = realNow();
      return { source: cfg.source, now: () => new Date(anchor + (realNow() - anchor) * rate) };
    }
    default:
      return { source: 'LOCAL_REAL_TIME', now: () => new Date(realNow()) };
  }
}
