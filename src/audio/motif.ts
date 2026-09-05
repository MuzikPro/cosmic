/**
 * 乐句选择（纯函数，可测）：按当前权重决定"谁在说话"，按五行方向决定乐句怎么走。
 * 当令音 0.5 / 调式内相邻两音共 0.25 / 其余共 0.25（spec §10 的默认，不是硬性）。
 */
import type { FiveTone } from '@/data/meridianClock';
import { modeIntervals, TONE_ORDER } from './scale';

export type Rng = () => number;

export interface MotifSpec {
  /** 相对调中心的半音数序列（已含八度） */
  semis: number[];
  tones: FiveTone[];
  /** 音与音之间的间隔（秒） */
  gaps: number[];
}

/** 加权抽样 */
export function weightedPick<T extends string>(weights: Record<T, number>, rng: Rng): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return entries[0][0];
  let r = rng() * total;
  for (const [k, w] of entries) { r -= Math.max(0, w); if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

/** 五音事件权重：以 root 为中心 0.5，调式内相邻两音各 0.125，其余均分 0.25 */
export function toneEventWeights(root: FiveTone): Record<FiveTone, number> {
  const iv = modeIntervals(root);                    // [root, a, b, c, d] 升序
  const neighbours = new Set<FiveTone>([iv[1].tone, iv[4].tone]);   // 上邻与下邻（环形）
  const out = {} as Record<FiveTone, number>;
  for (const t of TONE_ORDER) out[t] = t === root ? 0.5 : neighbours.has(t) ? 0.125 : 0.125;
  return out;
}

/**
 * 生成一个乐句：首音按权重抽；后续按方向偏置在调式音级上走一步或两步；
 * direction ∈ [-1, 1]：+1 几乎总上行，0 上下各半，-1 几乎总下行。八度随之进位。
 */
export function pickMotif(root: FiveTone, direction: number, maxLen: number, octave: number, rng: Rng): MotifSpec {
  const len = 1 + Math.floor(rng() * Math.max(1, maxLen));
  const weights = toneEventWeights(root);
  const first = weightedPick(weights, rng);
  const ladder = modeIntervals(root);                // 调式音阶（相对 root）
  let idx = ladder.findIndex((x) => x.tone === first);
  let oct = octave;
  const semis: number[] = [];
  const tones: FiveTone[] = [];
  const gaps: number[] = [];
  const rootSemis = ladder[0].semis;   // 0
  for (let i = 0; i < len; i++) {
    tones.push(ladder[idx].tone);
    semis.push(ladder[idx].semis - rootSemis + 12 * oct);
    if (i < len - 1) {
      const up = rng() < (direction + 1) / 2;
      const step = rng() < 0.7 ? 1 : 2;
      idx += up ? step : -step;
      while (idx >= ladder.length) { idx -= ladder.length; oct += 1; }
      while (idx < 0) { idx += ladder.length; oct -= 1; }
      gaps.push(1.5 + rng() * 2.5);
    }
  }
  return { semis, tones, gaps };
}
