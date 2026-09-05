/**
 * 时辰经络（Temporal Meridian）——共享类型（owner 2026-09-05）。
 *
 * 这是"时间 → 时辰 → 当令经络 → 五行 → 五音 → 视觉侧重 / 生成音景"这条链的
 * 唯一状态形状。视觉与音频都订阅同一份状态，不各自重算当令经络。
 *
 * 术语边界：这里用的是通行的"十二时辰配十二经"钟面（Meridian Clock），
 * 不宣称等同于完整的子午流注针法体系；教学、文化、冥想与艺术用途，
 * 非诊疗依据。
 */
import type { FiveElement, FiveTone, Polarity, ShichenEntry } from '@/data/meridianClock';

export type { FiveElement, FiveTone, Polarity, ShichenEntry };

export type TimeSource = 'LOCAL_REAL_TIME' | 'MANUAL_SHICHEN' | 'PREVIEW_24H_CYCLE';
export type OverlayMode = 'OFF' | 'MINIMAL' | 'DETAILED';
export type SpatialMode = 'OFF' | 'SUBTLE' | 'FULL';

/** 由钟面时刻解析出的纯数据（与时间来源、开关无关） */
export interface TemporalResolution {
  index: number;                 // 0=子 … 11=亥
  entry: ShichenEntry;           // 当令
  previous: ShichenEntry;        // 上一时辰
  next: ShichenEntry;            // 下一时辰
  partner: ShichenEntry;         // 当令经的表里配对
  elapsedSeconds: number;        // 本时辰已过秒数 [0, 7200)
  slotProgress: number;          // 0–1
  /** 过渡权重，三者之和恒为 1；时辰边界处 0.5/0.5 平滑交接 */
  previousWeight: number;
  activeWeight: number;
  nextWeight: number;
  /** 'in' 前段残留过渡；'out' 末段预交接；null 稳定段 */
  transition: 'in' | 'out' | null;
}

/** 视觉与音频共同订阅的运行态（关闭时为 null） */
export interface TemporalMeridianState extends TemporalResolution {
  source: TimeSource;
  now: Date;                     // 解析所用的（真实或虚拟）时刻
  manual: boolean;               // MANUAL_SHICHEN：不跟随当前时间
  preview: boolean;              // PREVIEW_24H_CYCLE：压缩的一天
}

/** 用户偏好（持久化的只有这个；不持久化过期的当令状态） */
export interface TemporalSoundscapeSettings {
  enabled: boolean;
  timeSource: TimeSource;
  manualIndex: number;           // 0–11（MANUAL_SHICHEN）
  previewCycleMinutes: number;   // 1–60（PREVIEW_24H_CYCLE：一天压成几分钟）
  transitionMinutes: 5 | 10 | 15 | 20;
  masterVolume: number;          // 0–0.7
  musicDensity: number;          // 0–1
  tonalCenterMidi: number;       // 高级项；实现参考值，非"宫=某音"的史实断言
  octaveBias: number;            // -1…1
  spatialMode: SpatialMode;      // 第二波
  vesselModulation: boolean;     // 第二波
  overlay: OverlayMode;
  visualEmphasis: number;        // 0–1
}

export const DEFAULT_TEMPORAL_SETTINGS: TemporalSoundscapeSettings = {
  enabled: false,
  timeSource: 'LOCAL_REAL_TIME',
  manualIndex: 0,
  previewCycleMinutes: 12,
  transitionMinutes: 10,
  masterVolume: 0.2,
  musicDensity: 0.3,
  tonalCenterMidi: 50,
  octaveBias: 0,
  spatialMode: 'SUBTLE',
  vesselModulation: true,
  overlay: 'MINIMAL',
  visualEmphasis: 0.5
};
