/**
 * 时辰经络引擎（src/temporal）的正确性闸（owner 2026-09-05，spec §29 / §50）。
 * 钟面每个边界、十二条经的五行/五音/阴阳、过渡权重、模式隔离、预览时钟。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MERIDIAN_CLOCK, FIVE_TONES, partnerOf } from '../src/data/meridianClock';
import { TWELVE } from '../src/components/Acupoints/pointGeometry';
import {
  resolveAt, resolveTemporal, slotIndexAt, slotStartSeconds, secondsOfDay, smoothstep, meridianWeights,
  createVirtualClock, temporalStore, SLOT_SECONDS, emphasisScale
} from '../src/temporal';

const at = (h: number, m = 0, s = 0) => h * 3600 + m * 60 + s;
const ORDER = ['GB', 'LR', 'LU', 'LI', 'ST', 'SP', 'HT', 'SI', 'BL', 'KI', 'PC', 'TE'];

describe('clock table', () => {
  it('has 12 rows in 子…亥 order carrying the project meridian codes', () => {
    expect(MERIDIAN_CLOCK.map((e) => e.code)).toEqual(ORDER);
    expect(new Set(MERIDIAN_CLOCK.map((e) => e.code))).toEqual(new Set(TWELVE));
    expect(MERIDIAN_CLOCK.map((e) => e.startHour)).toEqual([23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]);
  });
  it('maps tone / element / polarity for all twelve', () => {
    const tone = Object.fromEntries(MERIDIAN_CLOCK.map((e) => [e.code, e.tone]));
    expect(tone).toEqual({ GB: 'jue', LR: 'jue', LU: 'shang', LI: 'shang', ST: 'gong', SP: 'gong',
                           HT: 'zhi', SI: 'zhi', PC: 'zhi', TE: 'zhi', BL: 'yu', KI: 'yu' });
    const el = Object.fromEntries(MERIDIAN_CLOCK.map((e) => [e.code, e.element]));
    expect(el).toEqual({ GB: 'wood', LR: 'wood', LU: 'metal', LI: 'metal', ST: 'earth', SP: 'earth',
                         HT: 'fire', SI: 'fire', PC: 'fire', TE: 'fire', BL: 'water', KI: 'water' });
    const pol = Object.fromEntries(MERIDIAN_CLOCK.map((e) => [e.code, e.polarity]));
    expect(pol).toEqual({ GB: 'yang', LR: 'yin', LU: 'yin', LI: 'yang', ST: 'yang', SP: 'yin',
                          HT: 'yin', SI: 'yang', BL: 'yang', KI: 'yin', PC: 'yin', TE: 'yang' });
    expect(MERIDIAN_CLOCK.filter((e) => e.ministerFire).map((e) => e.code)).toEqual(['PC', 'TE']);
  });
  it('FIVE_TONES partitions the twelve and agrees with the table', () => {
    const all = Object.values(FIVE_TONES).flatMap((t) => t.codes).sort();
    expect(all).toEqual([...TWELVE].sort());
    for (const [tone, meta] of Object.entries(FIVE_TONES)) {
      for (const c of meta.codes) {
        const e = MERIDIAN_CLOCK.find((x) => x.code === c)!;
        expect(e.tone).toBe(tone);
        expect(e.element).toBe(meta.element);
      }
    }
  });
  it('partners are the 表里 pairs', () => {
    expect(partnerOf('LU')).toBe('LI'); expect(partnerOf('LI')).toBe('LU');
    expect(partnerOf('PC')).toBe('TE'); expect(partnerOf('GB')).toBe('LR');
    expect(partnerOf('CV')).toBeNull();
  });
});

describe('slot resolution and every boundary', () => {
  it('resolves each two-hour slot and wraps 子 across midnight', () => {
    expect(slotIndexAt(at(23))).toBe(0);
    expect(slotIndexAt(at(0, 30))).toBe(0);
    expect(slotIndexAt(at(0, 59, 59))).toBe(0);
    expect(slotIndexAt(at(1))).toBe(1);
    expect(slotIndexAt(at(12))).toBe(6);
    expect(slotIndexAt(at(22, 59, 59))).toBe(11);
    expect(slotStartSeconds(0)).toBe(at(23));
    expect(slotStartSeconds(1)).toBe(at(1));
  });
  it('one second before and exactly at each boundary', () => {
    for (let i = 0; i < 12; i++) {
      const start = slotStartSeconds(i);
      const before = resolveAt(start - 1, 10);
      const exact = resolveAt(start, 10);
      expect(before.entry.code).toBe(ORDER[(i + 11) % 12]);
      expect(exact.entry.code).toBe(ORDER[i]);
      expect(exact.elapsedSeconds).toBe(0);
      expect(before.elapsedSeconds).toBe(SLOT_SECONDS - 1);
    }
  });
  it('Date path uses local civil time (getHours) including the 子 wrap', () => {
    expect(resolveTemporal(new Date(2026, 0, 15, 22, 59, 59), 10).entry.code).toBe('TE');
    expect(resolveTemporal(new Date(2026, 0, 15, 23, 0, 0), 10).entry.code).toBe('GB');
    expect(resolveTemporal(new Date(2026, 0, 16, 0, 59, 59), 10).entry.code).toBe('GB');
    expect(resolveTemporal(new Date(2026, 0, 16, 1, 0, 0), 10).entry.code).toBe('LR');
    expect(secondsOfDay(new Date(2026, 5, 1, 17, 42, 0))).toBe(at(17, 42));
    const r = resolveTemporal(new Date(2026, 5, 1, 17, 42), 10);
    expect(r.entry.code).toBe('KI'); expect(r.entry.tone).toBe('yu'); expect(r.entry.shichen).toBe('酉');
    expect(r.slotProgress).toBeCloseTo(42 / 120, 5);
  });
  it('previous / next / partner are consistent', () => {
    const r = resolveAt(at(17, 42), 10);
    expect(r.previous.code).toBe('BL'); expect(r.next.code).toBe('PC'); expect(r.partner.code).toBe('BL');
    const z = resolveAt(at(23, 30), 10);
    expect(z.previous.code).toBe('TE'); expect(z.next.code).toBe('LR'); expect(z.partner.code).toBe('LR');
  });
});

describe('transition weights', () => {
  const sum = (r: ReturnType<typeof resolveAt>) => r.previousWeight + r.activeWeight + r.nextWeight;
  it('smoothstep is clamped and symmetric', () => {
    expect(smoothstep(-1)).toBe(0); expect(smoothstep(2)).toBe(1); expect(smoothstep(0.5)).toBe(0.5);
  });
  it('beginning: previous residue fades, active rises from 0.5', () => {
    const r0 = resolveAt(at(17), 10);
    expect(r0.activeWeight).toBeCloseTo(0.5); expect(r0.previousWeight).toBeCloseTo(0.5); expect(r0.nextWeight).toBe(0);
    expect(r0.transition).toBe('in');
    const r5 = resolveAt(at(17, 5), 10);
    expect(r5.activeWeight).toBeCloseTo(smoothstep(0.75)); expect(r5.activeWeight).toBeGreaterThan(0.8);
    const r10 = resolveAt(at(17, 10), 10);
    expect(r10.activeWeight).toBe(1); expect(r10.transition).toBeNull();
  });
  it('middle: fully present', () => {
    const r = resolveAt(at(18), 10);
    expect(r.activeWeight).toBe(1); expect(r.previousWeight).toBe(0); expect(r.nextWeight).toBe(0);
  });
  it('end: next rises toward 0.5 at the boundary, continuous across it', () => {
    const r50 = resolveAt(at(18, 50), 10);
    expect(r50.nextWeight).toBe(0); expect(r50.transition).toBeNull();
    const r55 = resolveAt(at(18, 55), 10);
    expect(r55.transition).toBe('out'); expect(r55.nextWeight).toBeCloseTo(smoothstep(0.25));
    const before = resolveAt(at(19) - 0.001, 10);
    const after = resolveAt(at(19), 10);
    // 边界两侧：KI 的权重（before.active vs after.previous）连续
    expect(before.activeWeight).toBeCloseTo(after.previousWeight, 3);
    expect(before.nextWeight).toBeCloseTo(after.activeWeight, 3);
  });
  it('weights always sum to 1 and honour every configured window', () => {
    for (const T of [5, 10, 15, 20]) {
      for (let s = 0; s < 86400; s += 97) {
        const r = resolveAt(s, T);
        expect(sum(r)).toBeCloseTo(1, 9);
        if (r.elapsedSeconds >= T * 60 && r.elapsedSeconds <= SLOT_SECONDS - T * 60) expect(r.activeWeight).toBe(1);
      }
    }
    // 过渡 0 分钟：任何时刻都是硬切但仍合法
    expect(resolveAt(at(17), 0).activeWeight).toBe(1);
  });
  it('midnight wrap keeps 子 weights continuous', () => {
    const r = resolveAt(at(0, 55), 10);
    expect(r.entry.code).toBe('GB'); expect(r.transition).toBe('out'); expect(r.next.code).toBe('LR');
    const q = resolveAt(at(23, 5), 10);
    expect(q.entry.code).toBe('GB'); expect(q.transition).toBe('in'); expect(q.previous.code).toBe('TE');
  });
});

describe('per-meridian weights (visual emphasis / event weighting)', () => {
  it('active 1.0, partner 0.3, others 0.1; nothing ever disappears', () => {
    const w = meridianWeights(resolveAt(at(18), 10));
    expect(w.KI).toBeCloseTo(1); expect(w.BL).toBeCloseTo(0.3); expect(w.LU).toBeCloseTo(0.1);
    expect(Object.keys(w).sort()).toEqual([...TWELVE].sort());
    expect(Math.min(...Object.values(w))).toBeGreaterThanOrEqual(0.1);
  });
  it('at a boundary both neighbours share the emphasis', () => {
    const w = meridianWeights(resolveAt(at(19), 10));   // KI → PC，各 0.5
    expect(w.KI).toBeCloseTo(0.55); expect(w.PC).toBeCloseTo(0.55);
  });
});

describe('time sources', () => {
  afterEach(() => { vi.useRealTimers(); temporalStore.reset(); });
  it('LOCAL_REAL_TIME reads the system clock', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 5, 17, 42, 0));
    expect(createVirtualClock({ source: 'LOCAL_REAL_TIME' }).now().getHours()).toBe(17);
  });
  it('MANUAL_SHICHEN pins the middle of the chosen slot', () => {
    const c = createVirtualClock({ source: 'MANUAL_SHICHEN', manualIndex: 9 });   // 酉
    const r = resolveTemporal(c.now(), 10);
    expect(r.entry.code).toBe('KI'); expect(r.slotProgress).toBeCloseTo(0.5); expect(r.activeWeight).toBe(1);
    const z = createVirtualClock({ source: 'MANUAL_SHICHEN', manualIndex: 0 });
    expect(z.now().getHours()).toBe(0);   // 子时中点 = 00:00
    expect(resolveTemporal(z.now(), 10).entry.code).toBe('GB');
  });
  it('PREVIEW_24H_CYCLE compresses a day and never runs in real-time mode', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 5, 17, 0, 0));
    const c = createVirtualClock({ source: 'PREVIEW_24H_CYCLE', previewCycleMinutes: 1 });   // 1440×
    expect(resolveTemporal(c.now(), 10).entry.code).toBe('KI');
    vi.setSystemTime(new Date(2026, 8, 5, 17, 0, 5));   // +5 s 真实 = +2 h 虚拟
    expect(resolveTemporal(c.now(), 10).entry.code).toBe('PC');
    vi.setSystemTime(new Date(2026, 8, 5, 17, 1, 0));   // +60 s = 一整天
    expect(resolveTemporal(c.now(), 10).entry.code).toBe('KI');
    const real = createVirtualClock({ source: 'LOCAL_REAL_TIME', previewCycleMinutes: 1 });
    expect(real.now().getHours()).toBe(17);
  });
});

describe('store: mode isolation and recompute', () => {
  afterEach(() => { vi.useRealTimers(); temporalStore.reset(); });
  const base = { timeSource: 'LOCAL_REAL_TIME' as const, manualIndex: 0, previewCycleMinutes: 12, transitionMinutes: 10 as const };
  it('disabled ⇒ null snapshot and no timer', () => {
    temporalStore.configure({ enabled: false, ...base });
    expect(temporalStore.getSnapshot()).toBeNull();
    expect(temporalStore.isRunning()).toBe(false);
  });
  it('enabled ⇒ resolves the current state and ticks; disabling clears it', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 5, 17, 42, 0));
    const seen: string[] = [];
    const unsub = temporalStore.subscribe(() => { seen.push(temporalStore.getSnapshot()?.entry.code ?? 'null'); });
    temporalStore.configure({ enabled: true, ...base });
    expect(temporalStore.isRunning()).toBe(true);
    expect(temporalStore.getSnapshot()?.entry.code).toBe('KI');
    expect(temporalStore.getSnapshot()?.manual).toBe(false);
    vi.setSystemTime(new Date(2026, 8, 5, 19, 30, 0)); vi.advanceTimersByTime(1000);
    expect(temporalStore.getSnapshot()?.entry.code).toBe('PC');   // 从"现在"重算，不追赶
    temporalStore.configure({ enabled: false, ...base });
    expect(temporalStore.getSnapshot()).toBeNull(); expect(temporalStore.isRunning()).toBe(false);
    expect(seen).toContain('KI'); expect(seen[seen.length - 1]).toBe('null');
    unsub();
  });
  it('same config is idempotent (preview anchor not reset); manual flag set', () => {
    temporalStore.configure({ enabled: true, ...base, timeSource: 'MANUAL_SHICHEN', manualIndex: 6 });
    const first = temporalStore.getSnapshot();
    temporalStore.configure({ enabled: true, ...base, timeSource: 'MANUAL_SHICHEN', manualIndex: 6 });
    expect(temporalStore.getSnapshot()).toBe(first);
    expect(first?.entry.code).toBe('HT'); expect(first?.manual).toBe(true);
  });
});

describe('visual emphasis scale', () => {
  it('is identity at zero emphasis and gently dominant otherwise', () => {
    for (const w of [0.1, 0.3, 0.55, 1]) expect(emphasisScale(w, 0)).toBe(1);
    expect(emphasisScale(1, 0.5)).toBeCloseTo(1.3);
    expect(emphasisScale(0.3, 0.5)).toBeCloseTo(0.79);
    expect(emphasisScale(0.1, 0.5)).toBeCloseTo(0.73);
    expect(emphasisScale(0.1, 1)).toBeCloseTo(0.46);
    expect(emphasisScale(1, 1)).toBeCloseTo(1.6);
    // 单调：权重越高系数越大；永不归零
    expect(emphasisScale(0.55, 0.5)).toBeGreaterThan(emphasisScale(0.3, 0.5));
    expect(emphasisScale(0.1, 1)).toBeGreaterThan(0.4);
  });
});

describe('debug time offset (LOCAL mode only, not persisted)', () => {
  afterEach(() => { vi.useRealTimers(); temporalStore.reset(); });
  it('shifts the virtual now in LOCAL mode and is part of the store config key', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 5, 18, 59, 30));
    const c = createVirtualClock({ source: 'LOCAL_REAL_TIME', debugOffsetSeconds: 60 });
    expect(resolveTemporal(c.now(), 10).entry.code).toBe('PC');   // 19:00:30
    const base = { enabled: true, timeSource: 'LOCAL_REAL_TIME' as const, manualIndex: 0, previewCycleMinutes: 12, transitionMinutes: 10 as const };
    temporalStore.configure(base);
    expect(temporalStore.getSnapshot()?.entry.code).toBe('KI');
    temporalStore.configure({ ...base, debugOffsetSeconds: 60 });
    expect(temporalStore.getSnapshot()?.entry.code).toBe('PC');
  });
});
