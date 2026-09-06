/**
 * 五音音阶（owner 2026-09-05）：宫商角徵羽是**相对的调式功能**，不是固定的西方绝对音高。
 * 这里只存半音偏移；tonalCenterMidi 是实现参考值（默认 50），整个音景随之整体移调。
 * 代码与界面都不写"宫=D"之类的史实断言。
 */
import type { FiveTone } from '@/data/meridianClock';

/** 相对于调式中心（宫）的半音偏移：宫0 商2 角4 徵7 羽9 */
export const PENTATONIC_DEGREES: Record<FiveTone, number> = { gong: 0, shang: 2, jue: 4, zhi: 7, yu: 9 };
export const TONE_ORDER: FiveTone[] = ['gong', 'shang', 'jue', 'zhi', 'yu'];

export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** 某音在给定调中心、给定八度偏移下的 MIDI 号 */
export function toneMidi(tone: FiveTone, centerMidi: number, octave = 0): number {
  return centerMidi + PENTATONIC_DEGREES[tone] + 12 * octave;
}

/**
 * 以某音为"主音"的五声调式（宫调式/商调式/角调式/徵调式/羽调式）：
 * 返回从该主音起、按音高升序排列的五个音（相对主音的半音数）。
 * 例：羽调式 = 羽0 宫3 商5 角7 徵10（听感偏暗、下沉）；角调式 = 角0 徵3 羽5 宫8 商10。
 */
export function modeIntervals(root: FiveTone): Array<{ tone: FiveTone; semis: number }> {
  const r = PENTATONIC_DEGREES[root];
  return TONE_ORDER
    .map((t) => ({ tone: t, semis: (PENTATONIC_DEGREES[t] - r + 12) % 12 }))
    .sort((a, b) => a.semis - b.semis);
}

/**
 * 一个以 root 为中心的和声铺底配置（三个音的 MIDI 号）：主音 + 调式内相邻两音，
 * 保持在同一八度内。root 决定"哪个五音是重心"；宫始终另有恒定的极低基底（见 soundscape）。
 */
export function bedVoicing(root: FiveTone, centerMidi: number, octaveBias = 0): number[] {
  const rootMidi = toneMidi(root, centerMidi, 0);
  const iv = modeIntervals(root);   // [0, a, b, c, d]
  // 主音、上方第二与第三个调式音——如羽调式：羽 宫+3 商+5 → 密集而暗；角调式：角 徵+3 羽+5
  const picks = [iv[0].semis, iv[1].semis, iv[2].semis];
  return picks.map((s) => rootMidi + s + 12 * Math.round(octaveBias));
}

/** 事件音的候选池：五音各自的 MIDI 号（同一八度），供加权抽取 */
export function tonePool(centerMidi: number, octave = 0): Record<FiveTone, number> {
  const out = {} as Record<FiveTone, number>;
  for (const t of TONE_ORDER) out[t] = toneMidi(t, centerMidi, octave);
  return out;
}
