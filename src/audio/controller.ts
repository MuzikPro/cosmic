/**
 * 音景控制器：把 实时音频（liveAudio）× 时辰状态（temporalStore）× 音景（Soundscape）接在一起。
 * 调度：每 100 ms 以 1.0 s 前瞻向 Web Audio 排事件（setInterval 只负责补队列，不做音乐计时）。
 */
import { temporalStore } from '@/temporal/temporalStore';
import { liveAudio } from './audioEngine';
import { Soundscape, SoundscapeParams } from './soundscape';

const TICK_MS = 100;
const AHEAD_S = 1.0;

class SoundscapeController {
  private scape: Soundscape | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsub: (() => void) | null = null;
  private planned = 0;

  get active(): boolean { return this.scape !== null; }

  /** 需要 liveAudio 已在运行（有图）；否则什么也不做 */
  attach(params: SoundscapeParams): boolean {
    const g = liveAudio.audioGraph;
    if (!g || this.scape) return this.scape !== null;
    const ctx = g.ctx;
    this.scape = new Soundscape(ctx, g.input, params, Math.random, { wet: g.wetIn, bedBus: g.bedBus, orbit: g.orbit, reverbSend: g.reverbSend });
    const push = () => {
      const s = temporalStore.getSnapshot();
      if (s && this.scape) this.scape.update(s, ctx.currentTime);
    };
    push();
    this.unsub = temporalStore.subscribe(push);
    this.planned = ctx.currentTime;
    this.timer = setInterval(() => {
      if (!this.scape) return;
      const now = ctx.currentTime;
      const from = Math.max(this.planned, now);
      const to = now + AHEAD_S;
      if (to > from) { this.scape.plan(from, to, () => temporalStore.getSnapshot()); this.planned = to; }
    }, TICK_MS);
    return true;
  }

  setParams(p: Partial<SoundscapeParams>): void { this.scape?.setParams(p); }

  detach(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.unsub) { this.unsub(); this.unsub = null; }
    const g = liveAudio.audioGraph;
    if (this.scape && g) this.scape.stop(g.ctx.currentTime);
    this.scape = null;
  }
}

export const soundscapeController = new SoundscapeController();
