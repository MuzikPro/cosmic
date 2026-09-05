/**
 * 合成器声部（owner 2026-09-05）：纯合成，不用传统乐器采样。
 * 一切时间参数都是绝对的 ctx 时间（at），实时与离线渲染同一套代码。
 */
import { midiToHz } from './scale';

const cents = (c: number) => Math.pow(2, c / 1200);

export interface PadNote {
  midi: number; at: number; attack: number; hold: number; release: number;
  cutoff: number; cutoffSwing: number; gain: number; pan: number; detuneCents?: number;
}
/** 三振荡器铺垫音：锯齿 + 三角 + 反向失谐锯齿 → 24 dB 低通（两级）→ 包络 → 声像 */
export function playPad(ctx: BaseAudioContext, dest: AudioNode, n: PadNote): void {
  const f = midiToHz(n.midi);
  const det = n.detuneCents ?? 7;
  const oscs: OscillatorNode[] = [];
  const mk = (type: OscillatorType, ratio: number, g: number) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * ratio;
    const og = ctx.createGain(); og.gain.value = g; o.connect(og); return { o, og };
  };
  const a = mk('sawtooth', cents(det), 0.33), b = mk('triangle', 1, 0.5), c = mk('sawtooth', cents(-det), 0.33);
  const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.Q.value = 0.7;
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.Q.value = 0.5;
  const env = ctx.createGain(); env.gain.value = 0;
  const pan = ctx.createStereoPanner(); pan.pan.value = n.pan;
  [a, b, c].forEach(({ o, og }) => { og.connect(lp1); oscs.push(o); });
  lp1.connect(lp2); lp2.connect(env); env.connect(pan); pan.connect(dest);
  const end = n.at + n.attack + n.hold + n.release;
  // 滤波：从暗到亮再回暗（一个缓慢的呼吸）
  lp1.frequency.setValueAtTime(Math.max(80, n.cutoff - n.cutoffSwing), n.at);
  lp1.frequency.linearRampToValueAtTime(n.cutoff + n.cutoffSwing * 0.5, n.at + n.attack + n.hold * 0.5);
  lp1.frequency.linearRampToValueAtTime(Math.max(80, n.cutoff - n.cutoffSwing), end);
  lp2.frequency.setValueAtTime(n.cutoff * 1.6, n.at);
  env.gain.setValueAtTime(0, n.at);
  env.gain.linearRampToValueAtTime(n.gain, n.at + n.attack);
  env.gain.setValueAtTime(n.gain, n.at + n.attack + n.hold);
  env.gain.linearRampToValueAtTime(0, end);
  oscs.forEach((o) => { o.start(n.at); o.stop(end + 0.05); });
}

export interface BellNote { midi: number; at: number; release: number; gain: number; pan: number; brightness: number; metallic?: boolean }
/** FM 铃：载波正弦 + 调制正弦（比 2:1 温暖 / 3.01:1 金属），调制指数随时间衰减 */
export function playBell(ctx: BaseAudioContext, dest: AudioNode, n: BellNote): void {
  const f = midiToHz(n.midi);
  const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
  const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * (n.metallic ? 3.01 : 2);
  const modGain = ctx.createGain();
  const index = f * (0.6 + 1.6 * n.brightness);
  modGain.gain.setValueAtTime(index, n.at);
  modGain.gain.exponentialRampToValueAtTime(Math.max(1, index * 0.05), n.at + n.release * 0.6);
  mod.connect(modGain); modGain.connect(car.frequency);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, n.at);
  env.gain.exponentialRampToValueAtTime(n.gain, n.at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, n.at + n.release);
  const pan = ctx.createStereoPanner(); pan.pan.value = n.pan;
  car.connect(env); env.connect(pan); pan.connect(dest);
  car.start(n.at); mod.start(n.at); car.stop(n.at + n.release + 0.05); mod.stop(n.at + n.release + 0.05);
}

export interface SubNote { midi: number; at: number; attack: number; release: number; gain: number; pan: number }
/** 低音正弦花开：正弦 + 微弱二次谐波，慢起慢收 */
export function playSub(ctx: BaseAudioContext, dest: AudioNode, n: SubNote): void {
  const f = midiToHz(n.midi);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.12;
  const env = ctx.createGain(); env.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 4;
  const pan = ctx.createStereoPanner(); pan.pan.value = n.pan;
  o1.connect(env); o2.connect(g2); g2.connect(env); env.connect(lp); lp.connect(pan); pan.connect(dest);
  const end = n.at + n.attack + n.release;
  env.gain.setValueAtTime(0, n.at);
  env.gain.linearRampToValueAtTime(n.gain, n.at + n.attack);
  env.gain.linearRampToValueAtTime(0, end);
  o1.start(n.at); o2.start(n.at); o1.stop(end + 0.05); o2.stop(end + 0.05);
}

/** 持续声部：一组正弦/三角（用于宫基底），增益与音高可平滑改写 */
export interface Drone { setGain(v: number, at: number, tc?: number): void; setMidi(midi: number, at: number, glide?: number): void; stop(at: number): void }
export function createDrone(ctx: BaseAudioContext, dest: AudioNode, midi: number, breathPeriod = 45): Drone {
  const f = midiToHz(midi);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
  // 二次谐波（~147 Hz）是基底里最"听得见"的成分（owner 2026-09-05：宫太可闻）——压到几乎没有
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.04;
  const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = f / 2;   // 更低一层的耳语
  const g3 = ctx.createGain(); g3.gain.value = 0.5;
  const gain = ctx.createGain(); gain.gain.value = 0;
  // 呼吸：LFO 调制一个乘法增益 0.75–1
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1 / breathPeriod;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.125;
  const breath = ctx.createGain(); breath.gain.value = 0.875;
  lfo.connect(lfoGain); lfoGain.connect(breath.gain);
  o1.connect(gain); o2.connect(g2); g2.connect(gain); o3.connect(g3); g3.connect(gain);
  gain.connect(breath); breath.connect(dest);
  const t0 = ctx.currentTime;
  [o1, o2, o3, lfo].forEach((o) => o.start(t0));
  return {
    setGain(v, at, tc = 4) { gain.gain.setTargetAtTime(v, at, tc); },
    setMidi(m, at, glide = 8) {
      const nf = midiToHz(m);
      o1.frequency.setTargetAtTime(nf, at, glide / 3); o2.frequency.setTargetAtTime(nf * 2, at, glide / 3); o3.frequency.setTargetAtTime(nf / 2, at, glide / 3);
    },
    stop(at) { gain.gain.setTargetAtTime(0, at, 2); [o1, o2, o3, lfo].forEach((o) => o.stop(at + 10)); }
  };
}

/** 持续铺垫和弦：三个持续 pad 声部，增益随权重平滑变化；用于前/当/后三种调式中心的交叉淡化 */
export interface BedChord { setGain(v: number, at: number, tc?: number): void; setCutoff(hz: number, at: number): void; stop(at: number): void }
export function createBedChord(ctx: BaseAudioContext, dest: AudioNode, midis: number[], cutoff: number, width: number, detuneCents = 6): BedChord {
  const out = ctx.createGain(); out.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6; lp.frequency.value = cutoff;
  // 缓慢的滤波呼吸（~90 s）
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1 / 90;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = cutoff * 0.35;
  lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
  lp.connect(out); out.connect(dest);
  const oscs: OscillatorNode[] = [lfo];
  midis.forEach((m, i) => {
    const f = midiToHz(m);
    const pan = ctx.createStereoPanner(); pan.pan.value = midis.length > 1 ? ((i / (midis.length - 1)) * 2 - 1) * width * 0.6 : 0;
    const vg = ctx.createGain(); vg.gain.value = 0.16;
    const mk = (type: OscillatorType, ratio: number, g: number) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * ratio;
      const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(vg); oscs.push(o);
    };
    mk('sawtooth', cents(detuneCents), 0.3); mk('triangle', 1, 0.55); mk('sawtooth', cents(-detuneCents), 0.3);
    vg.connect(pan); pan.connect(lp);
  });
  const t0 = ctx.currentTime;
  oscs.forEach((o) => o.start(t0));
  return {
    setGain(v, at, tc = 3) { out.gain.setTargetAtTime(v, at, tc); },
    setCutoff(hz, at) { lp.frequency.setTargetAtTime(hz, at, 6); },
    stop(at) { out.gain.setTargetAtTime(0, at, 3); oscs.forEach((o) => o.stop(at + 15)); }
  };
}

/** 气息层：环形播放的粉噪 → 带通 → 增益 */
export interface Air { setLevel(v: number, at: number): void; setFreq(hz: number, at: number): void; stop(at: number): void }
export function createAir(ctx: BaseAudioContext, dest: AudioNode): Air {
  const seconds = 4; const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(2, seconds * rate, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0; let seed = 99991 + ch * 7;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0; const w = (seed / 4294967296) * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.08;
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = 900;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(bp); bp.connect(g); g.connect(dest); src.start(ctx.currentTime);
  return {
    setLevel(v, at) { g.gain.setTargetAtTime(v, at, 5); },
    setFreq(hz, at) { bp.frequency.setTargetAtTime(hz, at, 8); },
    stop(at) { g.gain.setTargetAtTime(0, at, 2); src.stop(at + 8); }
  };
}

/**
 * 华丽铃（白天的事件音，owner 2026-09-05）：主铃 + 高八度铃（120 ms 后、对侧声像、只进湿路）+
 * 高五度微弱闪光（只进湿路）+ 短促的正弦身体。上层全走湿路：更开阔而不更响。
 */
export interface GrandBellNote extends BellNote { wet: AudioNode }
export function playGrandBell(ctx: BaseAudioContext, dest: AudioNode, n: GrandBellNote): void {
  playBell(ctx, dest, { midi: n.midi, at: n.at, release: n.release, gain: n.gain, pan: n.pan, brightness: n.brightness, metallic: n.metallic });
  playBell(ctx, n.wet, { midi: n.midi + 12, at: n.at + 0.12, release: n.release * 1.2, gain: n.gain * 0.5, pan: -n.pan, brightness: n.brightness * 0.8, metallic: n.metallic });
  playBell(ctx, n.wet, { midi: n.midi + 19, at: n.at + 0.35, release: n.release * 1.4, gain: n.gain * 0.24, pan: n.pan * 0.5, brightness: 0.4 });
  playSub(ctx, dest, { midi: n.midi - 12, at: n.at, attack: 0.08, release: 4, gain: n.gain * 0.5, pan: 0 });
}

/**
 * 厚垫（夜间的事件音）：两层三振荡器 pad（一层干、一层更宽失谐只进湿路、晚 200 ms）+ 低八度正弦身体。
 * 慢起慢收，滤波更暗——"柔软而巨大"。
 */
export interface FatPadNote extends PadNote { wet: AudioNode }
export function playFatPad(ctx: BaseAudioContext, dest: AudioNode, n: FatPadNote): void {
  playPad(ctx, dest, { ...n, detuneCents: 12 });
  playPad(ctx, n.wet, { ...n, at: n.at + 0.2, gain: n.gain * 0.7, detuneCents: 19, pan: -n.pan, cutoff: n.cutoff * 0.8 });
  playSub(ctx, dest, { midi: n.midi - 12, at: n.at, attack: n.attack * 1.2, release: n.release, gain: n.gain * 0.55, pan: 0 });
}

/* ───────────────── 第二批声部（owner 2026-09-05 点名）───────────────── */

/** 弓弦垫击：两把锯齿 + 三角，±5 音分，1 s 后进入 5.2 Hz 揉弦，低通从暗到亮像一弓拉开；带一丝松香噪声 */
export interface BowedNote { midi: number; at: number; attack: number; hold: number; release: number; cutoff: number; gain: number; pan: number; wet: AudioNode }
export function playBowed(ctx: BaseAudioContext, dest: AudioNode, n: BowedNote): void {
  const f = midiToHz(n.midi);
  const end = n.at + n.attack + n.hold + n.release;
  const env = ctx.createGain(); env.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = Math.max(60, f * 0.5);
  const pan = ctx.createStereoPanner(); pan.pan.value = n.pan;
  const wetTap = ctx.createGain(); wetTap.gain.value = 0.8;
  const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.2;
  const vibDepth = ctx.createGain(); vibDepth.gain.setValueAtTime(0, n.at); vibDepth.gain.linearRampToValueAtTime(f * 0.0035, n.at + n.attack + 1);
  vib.connect(vibDepth);
  const oscs: OscillatorNode[] = [vib];
  const mk = (type: OscillatorType, ratio: number, g: number) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * ratio; vibDepth.connect(o.frequency);
    const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(lp); oscs.push(o);
  };
  mk('sawtooth', cents(5), 0.28); mk('sawtooth', cents(-5), 0.28); mk('triangle', 1, 0.45);
  // 松香：窄带噪声，跟随包络
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = nb.getChannelData(0); let sd = 4242;
  for (let i = 0; i < nd.length; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; nd[i] = (sd / 4294967296) * 2 - 1; }
  const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
  const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = f * 2; nbp.Q.value = 6;
  const ng = ctx.createGain(); ng.gain.value = 0.05; noise.connect(nbp); nbp.connect(ng); ng.connect(lp);
  lp.connect(hp); hp.connect(env); env.connect(pan); pan.connect(dest); env.connect(wetTap); wetTap.connect(n.wet);
  lp.frequency.setValueAtTime(Math.max(150, n.cutoff * 0.3), n.at);
  lp.frequency.linearRampToValueAtTime(n.cutoff, n.at + n.attack);
  lp.frequency.setTargetAtTime(n.cutoff * 0.6, n.at + n.attack + n.hold, n.release / 3);
  env.gain.setValueAtTime(0, n.at);
  env.gain.linearRampToValueAtTime(n.gain, n.at + n.attack);
  env.gain.setValueAtTime(n.gain, n.at + n.attack + n.hold);
  env.gain.linearRampToValueAtTime(0, end);
  oscs.forEach((o) => { o.start(n.at); o.stop(end + 0.05); }); noise.start(n.at); noise.stop(end + 0.05);
}

/** 钵鸣：正弦 f + 微失谐的 2.01f（自然拍频）+ 弱 3.02f；慢起、长留、长收；副本进湿路 */
export interface BowlNote { midi: number; at: number; attack: number; hold: number; release: number; gain: number; pan: number; wet: AudioNode }
export function playBowl(ctx: BaseAudioContext, dest: AudioNode, n: BowlNote): void {
  const f = midiToHz(n.midi);
  const end = n.at + n.attack + n.hold + n.release;
  const env = ctx.createGain(); env.gain.value = 0;
  const pan = ctx.createStereoPanner(); pan.pan.value = n.pan;
  const wetTap = ctx.createGain(); wetTap.gain.value = 1.1;
  const oscs: OscillatorNode[] = [];
  const mk = (ratio: number, g: number) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * ratio; const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(env); oscs.push(o); };
  mk(1, 0.6); mk(2.01, 0.32); mk(3.02, 0.12); mk(0.5, 0.15);
  env.connect(pan); pan.connect(dest); env.connect(wetTap); wetTap.connect(n.wet);
  env.gain.setValueAtTime(0, n.at);
  env.gain.linearRampToValueAtTime(n.gain, n.at + n.attack);
  env.gain.setValueAtTime(n.gain, n.at + n.attack + n.hold);
  env.gain.setTargetAtTime(0, n.at + n.attack + n.hold, n.release / 4);
  oscs.forEach((o) => { o.start(n.at); o.stop(end + 0.1); });
}

/** 人声般的元音垫：两把锯齿 → 三个并联带通（共振峰 oo → ah 缓慢滑动）→ 低通；温暖、有人味 */
export interface VowelNote { midi: number; at: number; attack: number; hold: number; release: number; gain: number; pan: number; wet: AudioNode }
const VOWEL_OO = [300, 870, 2240], VOWEL_AH = [730, 1090, 2440], FORMANT_GAIN = [1, 0.5, 0.25];
export function playVowelPad(ctx: BaseAudioContext, dest: AudioNode, n: VowelNote): void {
  const f = midiToHz(n.midi);
  const end = n.at + n.attack + n.hold + n.release;
  const src = ctx.createGain(); src.gain.value = 0.35;
  const oscs: OscillatorNode[] = [];
  [cents(6), cents(-6)].forEach((r) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * r; o.connect(src); oscs.push(o); });
  const sum = ctx.createGain();
  VOWEL_OO.forEach((f1, i) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 8;
    bp.frequency.setValueAtTime(f1, n.at);
    bp.frequency.linearRampToValueAtTime(VOWEL_AH[i], n.at + n.attack + n.hold);
    bp.frequency.linearRampToValueAtTime(f1, end);
    const g = ctx.createGain(); g.gain.value = FORMANT_GAIN[i];
    src.connect(bp); bp.connect(g); g.connect(sum);
  });
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
  const env = ctx.createGain(); env.gain.value = 0;
  const pan = ctx.createStereoPanner(); pan.pan.value = n.pan;
  const wetTap = ctx.createGain(); wetTap.gain.value = 0.9;
  sum.connect(lp); lp.connect(env); env.connect(pan); pan.connect(dest); env.connect(wetTap); wetTap.connect(n.wet);
  env.gain.setValueAtTime(0, n.at);
  env.gain.linearRampToValueAtTime(n.gain, n.at + n.attack);
  env.gain.setValueAtTime(n.gain, n.at + n.attack + n.hold);
  env.gain.linearRampToValueAtTime(0, end);
  oscs.forEach((o) => { o.start(n.at); o.stop(end + 0.05); });
}

/** 颗粒闪光：几十粒极短的正弦（调式内音高、随机高八度、随机声像）在 2.5–3.5 s 内撒开，主要进湿路 */
export interface ShimmerNote { midis: number[]; at: number; spread: number; grains: number; gain: number; wet: AudioNode; rng: () => number }
export function playGranularShimmer(ctx: BaseAudioContext, dest: AudioNode, n: ShimmerNote): void {
  const dry = ctx.createGain(); dry.gain.value = 0.3; dry.connect(dest);
  const wet = ctx.createGain(); wet.gain.value = 0.9; wet.connect(n.wet);
  for (let i = 0; i < n.grains; i++) {
    const midi = n.midis[Math.floor(n.rng() * n.midis.length)] + 12 * Math.floor(n.rng() * 3);
    const t = n.at + n.rng() * n.spread;
    const len = 0.06 + n.rng() * 0.1;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midiToHz(midi);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(n.gain, t + len * 0.35); g.gain.linearRampToValueAtTime(0, t + len);
    const p = ctx.createStereoPanner(); p.pan.value = n.rng() * 1.6 - 0.8;
    o.connect(g); g.connect(p); p.connect(dry); p.connect(wet);
    o.start(t); o.stop(t + len + 0.02);
  }
}

/** 倒放式渐强：垫音 + 粉噪，长长升起、末尾骤停；主要进湿路——经典的"到达前"手势 */
export interface ReverseNote { midi: number; at: number; duration: number; cutoff: number; gain: number; wet: AudioNode }
export function playReverseSwell(ctx: BaseAudioContext, dest: AudioNode, n: ReverseNote): void {
  const f = midiToHz(n.midi);
  const end = n.at + n.duration;
  const env = ctx.createGain(); env.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
  const dry = ctx.createGain(); dry.gain.value = 0.35; const wet = ctx.createGain(); wet.gain.value = 1.0;
  const oscs: OscillatorNode[] = [];
  [[ 'sawtooth', cents(7), 0.3 ], [ 'sawtooth', cents(-7), 0.3 ], [ 'triangle', 1, 0.4 ]].forEach(([type, r, g]) => {
    const o = ctx.createOscillator(); o.type = type as OscillatorType; o.frequency.value = f * (r as number);
    const og = ctx.createGain(); og.gain.value = g as number; o.connect(og); og.connect(lp); oscs.push(o);
  });
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = nb.getChannelData(0); let b0 = 0, sd = 777;
  for (let i = 0; i < nd.length; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; const w = (sd / 4294967296) * 2 - 1; b0 = 0.98 * b0 + w * 0.05; nd[i] = b0 * 2; }
  const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
  const ng = ctx.createGain(); ng.gain.value = 0.25; noise.connect(ng); ng.connect(lp);
  lp.connect(env); env.connect(dry); dry.connect(dest); env.connect(wet); wet.connect(n.wet);
  lp.frequency.setValueAtTime(n.cutoff * 0.25, n.at);
  lp.frequency.exponentialRampToValueAtTime(n.cutoff * 1.4, end);
  env.gain.setValueAtTime(0.0001, n.at);
  env.gain.exponentialRampToValueAtTime(n.gain * 0.15, n.at + n.duration * 0.6);
  env.gain.exponentialRampToValueAtTime(n.gain, end - 0.02);
  env.gain.linearRampToValueAtTime(0, end + 0.06);   // 骤停（60 ms，不留咔哒）
  oscs.forEach((o) => { o.start(n.at); o.stop(end + 0.1); }); noise.start(n.at); noise.stop(end + 0.1);
}
