/**
 * 时辰解析（纯函数，无副作用）：一天中的秒数 → 当令时辰 / 进度 / 过渡权重。
 * 钟面表只此一份（src/data/meridianClock.ts）；此处不另抄映射。
 */
import { MERIDIAN_CLOCK, partnerOf } from '@/data/meridianClock';
import type { TemporalResolution } from './types';

export const SLOT_SECONDS = 7200;
export const DAY_SECONDS = 86400;
export const SLOT_COUNT = 12;

export const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** 本地民用时的当日秒数（含毫秒小数）；不假设 UTC，夏令时由 Date 自行处理 */
export function secondsOfDay(d: Date): number {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
}

/** 当日秒数 → 时辰索引（子=0 跨 23:00–01:00，显式回绕，不写 h>=23&&h<1 之类永假条件） */
export function slotIndexAt(seconds: number): number {
  const s = ((seconds % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  return Math.floor((((s / 3600) + 1) % 24) / 2);
}

/** 时辰起点的当日秒数（子时 = 23:00 = 82800） */
export function slotStartSeconds(index: number): number {
  return (((index * 2 + 23) % 24) * 3600);
}

export function resolveAt(seconds: number, transitionMinutes: number): TemporalResolution {
  const s = ((seconds % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  const index = slotIndexAt(s);
  const start = slotStartSeconds(index);
  const elapsed = ((s - start) % DAY_SECONDS + DAY_SECONDS) % DAY_SECONDS;   // 子时跨午夜也落在 [0,7200)
  const entry = MERIDIAN_CLOCK[index];
  const previous = MERIDIAN_CLOCK[(index + SLOT_COUNT - 1) % SLOT_COUNT];
  const next = MERIDIAN_CLOCK[(index + 1) % SLOT_COUNT];
  const partnerCode = partnerOf(entry.code);
  const partner = MERIDIAN_CLOCK.find((e) => e.code === partnerCode) ?? entry;

  // 过渡窗：以边界为中心、总宽 2T 的一次 smoothstep 交接——边界前 T 秒当令开始让位，
  // 边界时 0.5/0.5，边界后 T 秒交接完成。跨边界连续，无跳变。
  const tT = Math.max(0, Math.min(SLOT_SECONDS / 2, transitionMinutes * 60));
  let previousWeight = 0, activeWeight = 1, nextWeight = 0;
  let transition: TemporalResolution['transition'] = null;
  if (tT > 0 && elapsed < tT) {
    activeWeight = smoothstep((elapsed + tT) / (2 * tT));
    previousWeight = 1 - activeWeight;
    transition = 'in';
  } else if (tT > 0 && elapsed > SLOT_SECONDS - tT) {
    nextWeight = smoothstep((elapsed - (SLOT_SECONDS - tT)) / (2 * tT));
    activeWeight = 1 - nextWeight;
    transition = 'out';
  }
  return {
    index, entry, previous, next, partner,
    elapsedSeconds: elapsed, slotProgress: elapsed / SLOT_SECONDS,
    previousWeight, activeWeight, nextWeight, transition
  };
}

export function resolveTemporal(date: Date, transitionMinutes: number): TemporalResolution {
  return resolveAt(secondsOfDay(date), transitionMinutes);
}

/**
 * 每条经的当前权重（视觉侧重 / 音频事件加权共用）：当令 1，表里配对 0.3，其余 0.1；
 * 过渡期按权重在前/当/后三条经之间线性混合。所有经都保留可见——钟面表示"侧重"，不是有无。
 */
export function meridianWeights(r: TemporalResolution): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of MERIDIAN_CLOCK) out[e.code] = 0.1;
  const add = (center: typeof r.entry, w: number) => {
    if (w <= 0) return;
    out[center.code] = Math.max(out[center.code], 0.1 + 0.9 * w);
    const p = partnerOf(center.code);
    if (p) out[p] = Math.max(out[p], 0.1 + 0.2 * w);
  };
  add(r.previous, r.previousWeight);
  add(r.entry, r.activeWeight);
  add(r.next, r.nextWeight);
  return out;
}

/**
 * 视觉侧重系数：某经权重 w∈[0.1,1] × 侧重强度 e∈[0,1] → 乘到线亮度/粒径上。
 * e=0 恒为 1（无时间维度时原样）；e=0.5 时当令 ×1.3、其余 ×0.73——"一条经温和地突出"，不是有无之别。
 */
export function emphasisScale(w: number, e: number): number {
  const dim = 0.6 * e * (1 - w);
  const boost = 0.6 * e * Math.max(0, (w - 0.3) / 0.7);
  return 1 - dim + boost;
}
