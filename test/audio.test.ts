/**
 * 公开音频层（引擎）的可离线验证部分：五音音阶是相对的、可整体移调；乐句选择的方向与权重。
 * 编曲层（音色性格、和声进行、终止式、奇经调制）的测试随私有音色包（src/audio/pack/pack.test.ts）。
 */
import { describe, expect, it } from 'vitest';
import { PENTATONIC_DEGREES, TONE_ORDER, modeIntervals, bedVoicing, tonePool, toneMidi, midiToHz } from '../src/audio/scale';
import { pickMotif, toneEventWeights, weightedPick } from '../src/audio/motif';

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('five-tone scale is relative and transposable', () => {
  it('degrees 宫0 商2 角4 徵7 羽9; A4 = 440', () => {
    expect(PENTATONIC_DEGREES).toEqual({ gong: 0, shang: 2, jue: 4, zhi: 7, yu: 9 });
    expect(midiToHz(69)).toBeCloseTo(440);
  });
  it('modes: 羽调式 is the dark stack, 角调式 the rising one', () => {
    expect(modeIntervals('yu').map((x) => [x.tone, x.semis])).toEqual([['yu', 0], ['gong', 3], ['shang', 5], ['jue', 7], ['zhi', 10]]);
    expect(modeIntervals('jue').map((x) => [x.tone, x.semis])).toEqual([['jue', 0], ['zhi', 3], ['yu', 5], ['gong', 8], ['shang', 10]]);
    expect(modeIntervals('gong').map((x) => x.semis)).toEqual([0, 2, 4, 7, 9]);
  });
  it('changing the tonal center transposes every voicing by the same amount', () => {
    for (const t of TONE_ORDER) {
      const a = bedVoicing(t, 50), b = bedVoicing(t, 55);
      expect(b.map((m, i) => m - a[i])).toEqual([5, 5, 5]);
      expect(toneMidi(t, 62) - toneMidi(t, 50)).toBe(12);
    }
    const pool = tonePool(50);
    expect(pool.gong).toBe(50); expect(pool.yu).toBe(59);
  });
  it('bed voicing is rooted on the active tone (the modal center), not on 宫', () => {
    expect(bedVoicing('yu', 50)[0]).toBe(59);
    expect(bedVoicing('yu', 50)).toEqual([59, 62, 64]);
    expect(bedVoicing('zhi', 50)).toEqual([57, 59, 62]);
  });
});

describe('motif picking', () => {
  it('event weights: active 0.5, the rest share 0.5, sums to 1', () => {
    for (const t of TONE_ORDER) {
      const w = toneEventWeights(t);
      expect(w[t]).toBe(0.5);
      expect(Object.values(w).reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    }
  });
  it('weightedPick is deterministic under a seeded rng and honours zero weights', () => {
    expect(weightedPick({ a: 0, b: 1, c: 0 }, () => 0.5)).toBe('b');
    expect(weightedPick({ a: 1, b: 1 }, () => 0.1)).toBe('a');
    expect(weightedPick({ a: 1, b: 1 }, () => 0.9)).toBe('b');
  });
  it('wood rises, water sinks, earth holds', () => {
    // rng: len→4 notes, first tone = root (r<0.5), then "up?" draws 0.9, step draws 0.1 …
    const up = pickMotif('jue', 1, 4, 0, seq([0.99, 0.1, 0.9, 0.1, 0.5, 0.9, 0.1, 0.5, 0.9, 0.1, 0.5]));
    expect(up.semis.length).toBe(4);
    for (let i = 1; i < up.semis.length; i++) expect(up.semis[i]).toBeGreaterThan(up.semis[i - 1]);
    const down = pickMotif('yu', -1, 4, 0, seq([0.99, 0.1, 0.9, 0.1, 0.5, 0.9, 0.1, 0.5, 0.9, 0.1, 0.5]));
    for (let i = 1; i < down.semis.length; i++) expect(down.semis[i]).toBeLessThan(down.semis[i - 1]);
    const hold = pickMotif('gong', 0, 2, 0, seq([0.1]));
    expect(hold.semis).toEqual([0]);   // 单音守中
    expect(up.gaps.every((g) => g >= 1.5 && g <= 4)).toBe(true);
  });
  it('octave carries across the mode ladder', () => {
    const m = pickMotif('gong', 1, 4, 0, seq([0.99, 0.95, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5]));   // 从羽起一路两度上行
    expect(m.semis[m.semis.length - 1]).toBeGreaterThan(12);
  });
});

