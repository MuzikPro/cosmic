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
