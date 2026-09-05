/**
 * 音频引擎（owner 2026-09-05）：原生 Web Audio，无依赖。
 *
 *   声源 → 干/湿 → 合成混响（噪声脉冲响应，无采样文件） → 限幅器 → 总音量 → 输出
 *
 * 图的搭建对 BaseAudioContext 通用：实时播放用 AudioContext；离线渲染（自动化质检、测试）用
 * OfflineAudioContext。AudioContext 只在用户手势里创建/恢复（自动播放策略），失败静默。
 */

export interface AudioGraph {
  ctx: BaseAudioContext;
  input: GainNode;        // 各层接到这里（干 + 湿）
  wetIn: GainNode;        // 只进湿路（混响 + 延迟），不进干路——给"华丽铃"与"夜间厚垫"的上层
  dry: GainNode;
  reverbSend: GainNode;
  reverb: ConvolverNode;
  limiter: DynamicsCompressorNode;
  master: GainNode;
}

export const MASTER_DEFAULT = 0.2;
export const MASTER_MAX = 0.7;
export const FADE_SECONDS = 3;

/** 合成的立体声厅堂脉冲响应：指数衰减的噪声，右声道略去相关；高频衰减更快（用前置一阶低通近似） */
export function makeImpulse(ctx: BaseAudioContext, seconds = 8, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(seconds * rate));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    const k = Math.exp(-2 * Math.PI * 2200 / rate);   // 高频先走
    let seed = ch === 0 ? 1234567 : 7654321;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      lp = lp * k + white * (1 - k);
      const t = i / len;
      const env = Math.pow(1 - t, decay) * (1 - Math.exp(-i / (0.004 * rate)));   // 4 ms 起
      d[i] = lp * env;
    }
  }
  return buf;
}

/**
 * 更湿而不失"巨大合成器"的身体（owner 2026-09-05）：干声原样保留；湿路 = 直送混响 + 经乒乓延迟
 * （0.71 s / 1.09 s，低通 2.4 kHz，反馈 0.38）再入混响——延迟给出氛围的"空间回声"，
 * 长厅（12 s）给出尾巴；湿路上再切一点高频，让 pad 的存在感留在干路。
 */
export function buildGraph(ctx: BaseAudioContext, target: AudioNode = ctx.destination, masterGain = 0): AudioGraph {
  const input = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.78;
  const reverbSend = ctx.createGain(); reverbSend.gain.value = 0.95;
  const reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(ctx, 12, 2.6);
  const wetTone = ctx.createBiquadFilter(); wetTone.type = 'highshelf'; wetTone.frequency.value = 3200; wetTone.gain.value = -4;
  // 乒乓延迟网络
  const dL = ctx.createDelay(2); dL.delayTime.value = 0.71;
  const dR = ctx.createDelay(2); dR.delayTime.value = 1.09;
  const fbL = ctx.createGain(); fbL.gain.value = 0.38;
  const fbR = ctx.createGain(); fbR.gain.value = 0.38;
  const lpL = ctx.createBiquadFilter(); lpL.type = 'lowpass'; lpL.frequency.value = 2400;
  const lpR = ctx.createBiquadFilter(); lpR.type = 'lowpass'; lpR.frequency.value = 2400;
  const merger = ctx.createChannelMerger(2);
  const echoSend = ctx.createGain(); echoSend.gain.value = 0.5;
  const echoLevel = ctx.createGain(); echoLevel.gain.value = 0.55;
  input.connect(echoSend);
  const wetIn = ctx.createGain(); wetIn.gain.value = 1;
  wetIn.connect(reverb);
  const wetEcho = ctx.createGain(); wetEcho.gain.value = 0.4; wetIn.connect(wetEcho); wetEcho.connect(dL);
  echoSend.connect(dL); dL.connect(lpL); lpL.connect(fbL); fbL.connect(dR);   // L → R
  dR.connect(lpR); lpR.connect(fbR); fbR.connect(dL);                          // R → L
  lpL.connect(merger, 0, 0); lpR.connect(merger, 0, 1);
  merger.connect(echoLevel); echoLevel.connect(reverb);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 12;
  limiter.attack.value = 0.003; limiter.release.value = 0.25;
  const master = ctx.createGain(); master.gain.value = masterGain;
  input.connect(dry); dry.connect(limiter);
  input.connect(reverbSend); reverbSend.connect(reverb); reverb.connect(wetTone); wetTone.connect(limiter);
  limiter.connect(master); master.connect(target);
  return { ctx, input, wetIn, dry, reverbSend, reverb, limiter, master };
}

export type LiveState = 'idle' | 'running' | 'suspended' | 'blocked';

/**
 * 实时播放的生命周期：手势里 start()，淡入；stop() 淡出后挂起；页面隐藏时静默挂起、回到前台恢复。
 * 订阅者（界面的"开始声音"角标）通过 subscribe 得到状态变化。
 */
export class LiveAudio {
  private ctx: AudioContext | null = null;
  private graph: AudioGraph | null = null;
  private volume = MASTER_DEFAULT;
  private listeners = new Set<() => void>();
  private _state: LiveState = 'idle';

  get state(): LiveState { return this._state; }
  get audioGraph(): AudioGraph | null { return this.graph; }
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private setState(s: LiveState): void { if (this._state !== s) { this._state = s; this.listeners.forEach((l) => l()); } }

  static supported(): boolean {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  /** 必须在用户手势的调用栈里调用；返回是否已在运行 */
  async start(volume = this.volume): Promise<boolean> {
    this.volume = Math.min(MASTER_MAX, Math.max(0, volume));
    try {
      if (!this.ctx) {
        const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        this.ctx = new Ctor({ latencyHint: 'playback' });
        this.graph = buildGraph(this.ctx, this.ctx.destination, 0);
        this.ctx.addEventListener('statechange', () => this.syncState());
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      const g = this.graph!.master.gain;
      const t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(this.volume, t + FADE_SECONDS);
      this.syncState();
      return this.ctx.state === 'running';
    } catch {
      this.setState('blocked');
      return false;
    }
  }

  setVolume(v: number): void {
    this.volume = Math.min(MASTER_MAX, Math.max(0, v));
    if (!this.ctx || !this.graph || this.ctx.state !== 'running') return;
    const g = this.graph.master.gain; const t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.setTargetAtTime(this.volume, t, 0.4);
  }

  /** 淡出后挂起（不销毁图，随时可再 start） */
  async stop(fade = FADE_SECONDS): Promise<void> {
    if (!this.ctx || !this.graph) return;
    const g = this.graph.master.gain; const t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fade);
    await new Promise((r) => setTimeout(r, fade * 1000 + 50));
    if (this.ctx.state === 'running') await this.ctx.suspend().catch(() => undefined);
    this.syncState();
  }

  /** 页面隐藏：静默挂起；回到前台且此前已获手势：恢复 */
  async onVisibility(visible: boolean): Promise<void> {
    if (!this.ctx) return;
    if (!visible) { await this.stop(1); return; }
    if (this.ctx.state === 'suspended' && this._state !== 'idle') {
      try { await this.ctx.resume(); await this.start(this.volume); } catch { /* 需再次手势 */ }
    }
  }

  async dispose(): Promise<void> {
    if (!this.ctx) return;
    try { await this.ctx.close(); } catch { /* already closed */ }
    this.ctx = null; this.graph = null; this.setState('idle');
  }

  private syncState(): void {
    if (!this.ctx) { this.setState('idle'); return; }
    this.setState(this.ctx.state === 'running' ? 'running' : this.ctx.state === 'suspended' ? 'suspended' : 'idle');
  }
}

export const liveAudio = new LiveAudio();
