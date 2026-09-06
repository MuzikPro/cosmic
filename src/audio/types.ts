/**
 * 音频层的公开契约（owner 2026-09-05 开源核心拆分）：
 * 引擎（图、声部、调度）开源；编曲层（音色性格、调色板、和声进行、终止式、奇经调制映射、电平）
 * 是私有音色包，构建期覆盖到 src/audio/pack/，缺席时用 src/audio/fallback 的参考音色包。
 * 两者都实现下面的 SoundPack 接口。
 */
import type { TemporalResolution, SpatialMode } from '@/temporal/types';
import type { Rng } from './motif';

export const VESSEL_CODES = ['CV', 'GV', 'CHONG', 'DAI', 'YINQIAO', 'YANGQIAO', 'YINWEI', 'YANGWEI'] as const;
export type VesselCode = (typeof VESSEL_CODES)[number];
export type VesselWeights = Record<VesselCode, number>;   // 0–1

export interface SoundscapeParams {
  density: number;          // 0–1
  centerMidi: number;       // 实现参考值（默认 50），整体可移调；不是"宫=某音"的史实断言
  octaveBias: number;       // -1…1
  vessels?: VesselWeights;  // 奇经权重（由显示的奇经得来；关闭时全 0 ＝中性）
  spatialMode?: SpatialMode;
}

/** 音景可选接入的图节点（缺省时对应功能静默失效） */
export interface SoundscapeBuses { wet?: AudioNode; bedBus?: GainNode; orbit?: StereoPannerNode; reverbSend?: GainNode }

/** 音景实例：所有方法接受绝对 ctx 时间，实时与离线渲染共用 */
export interface SoundscapeLike {
  update(r: TemporalResolution, at: number): void;
  plan(from: number, to: number, stateAt: (t: number) => TemporalResolution | null): void;
  setParams(p: Partial<SoundscapeParams>): void;
  stop(at: number): void;
}

export interface SoundPack {
  name: string;
  createSoundscape(ctx: BaseAudioContext, dest: AudioNode, params: SoundscapeParams, rng?: Rng, buses?: AudioNode | SoundscapeBuses): SoundscapeLike;
  vesselWeightsFromVisible(visible: readonly string[], enabled: boolean): VesselWeights;
  describeModulation(visible: readonly string[], enabled: boolean, spatial: SpatialMode, polarity: 'yin' | 'yang' | null): string;
}
