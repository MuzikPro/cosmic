/**
 * 参考音色包（开源）：没有私有音色包时用它，保证仓库能构建、能出声、行为可读。
 * 内容刻意朴素——宫基底 + 当令音的一组铺垫 + 偶发的一个柔垫音；没有调色板、没有和声进行、
 * 没有终止式、没有奇经调制。真正的声音设计在私有的 cosmic-sound。
 */
import { FIVE_TONES } from '@/data/meridianClock';
import type { FiveTone } from '@/data/meridianClock';
import type { TemporalResolution } from '@/temporal/types';
import type { Rng } from '../motif';
import { bedVoicing, toneMidi } from '../scale';
import { BedChord, createBedChord, createDrone, playPad } from '../voices';
import type { SoundPack, SoundscapeBuses, SoundscapeLike, SoundscapeParams, VesselWeights } from '../types';
import { VESSEL_CODES } from '../types';

class ReferenceSoundscape implements SoundscapeLike {
  private beds = new Map<FiveTone, BedChord>();
  private foundation;
  private nextEventAt: number;
  private rng: Rng;
  private lastRes: TemporalResolution | null = null;
  private dest: AudioNode;
  constructor(private ctx: BaseAudioContext, dest: AudioNode, private params: SoundscapeParams, rng: Rng = Math.random, buses?: AudioNode | SoundscapeBuses) {
    this.rng = rng;
    this.dest = buses && 'connect' in (buses as AudioNode) ? dest : ((buses as SoundscapeBuses | undefined)?.bedBus ?? dest);
    this.foundation = createDrone(ctx, dest, toneMidi('gong', params.centerMidi, -1), 45);
    this.foundation.setGain(0.01, ctx.currentTime, 6);
    this.nextEventAt = ctx.currentTime + 6;
  }
  setParams(p: Partial<SoundscapeParams>): void { this.params = { ...this.params, ...p }; }
  update(r: TemporalResolution, at: number): void {
    this.lastRes = r;
    const w: Partial<Record<FiveTone, number>> = {};
    const add = (t: FiveTone, v: number) => { if (v > 0.001) w[t] = (w[t] ?? 0) + v; };
    add(r.previous.tone, r.previousWeight); add(r.entry.tone, r.activeWeight); add(r.next.tone, r.nextWeight);
    for (const [tone, weight] of Object.entries(w) as Array<[FiveTone, number]>) {
      let bed = this.beds.get(tone);
      if (!bed) { bed = createBedChord(this.ctx, this.dest, bedVoicing(tone, this.params.centerMidi, this.params.octaveBias), 800, 0.5); this.beds.set(tone, bed); }
      bed.setGain(0.4 * weight, at, 3);
    }
    this.beds.forEach((bed, tone) => { if (!(tone in w)) { bed.stop(at); this.beds.delete(tone); } });
  }
  plan(from: number, to: number, stateAt: (t: number) => TemporalResolution | null): void {
    if (this.nextEventAt < from) this.nextEventAt = from + 0.5;
    while (this.nextEventAt < to) {
      const r = stateAt(this.nextEventAt) ?? this.lastRes;
      if (r) {
        const midi = toneMidi(r.entry.tone, this.params.centerMidi, this.params.octaveBias + 1);
        playPad(this.ctx, this.dest, { midi, at: this.nextEventAt, attack: 2, hold: 2, release: 6, cutoff: 900, cutoffSwing: 300, gain: 0.14, pan: (this.rng() - 0.5) * 0.6 });
      }
      const density = Math.max(0, Math.min(1, this.params.density));
      this.nextEventAt += (12 + this.rng() * 12) / (0.4 + 0.6 * density);
    }
  }
  stop(at: number): void { this.beds.forEach((b) => b.stop(at)); this.beds.clear(); this.foundation.stop(at); }
}

export const PACK_NAME = 'reference (open-source fallback)';
export const createSoundscape: SoundPack['createSoundscape'] = (ctx, dest, params, rng, buses) => new ReferenceSoundscape(ctx, dest, params, rng, buses);
export const vesselWeightsFromVisible: SoundPack['vesselWeightsFromVisible'] = () => {
  const out = {} as VesselWeights; for (const c of VESSEL_CODES) out[c] = 0; return out;
};
export const describeModulation: SoundPack['describeModulation'] = () => `${PACK_NAME}: no vessel modulation`;
export const soundPack: SoundPack = { name: PACK_NAME, createSoundscape, vesselWeightsFromVisible, describeModulation };
void FIVE_TONES;
