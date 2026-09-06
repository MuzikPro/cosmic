/**
 * 宇宙经络屏保的设置（owner 2026-09-05）：只存用户配置，不存每帧镜头值。
 * 键 3dqiflow:screensaver；缺项按默认补齐，坏值不炸。
 */
import { TWELVE, VESSELS_EIGHT } from '../Acupoints/pointGeometry';
import { DEFAULT_TEMPORAL_SETTINGS, TemporalSoundscapeSettings } from '@/temporal/types';

export type ViewMode = 'cameraOrbit' | 'bodyRotation' | 'combined';
export type OrbitStyle = 'horizontal' | 'elevated' | 'spherical' | 'free';
export type AxisMode = 'y' | 'x' | 'z' | 'xyzDrift' | 'custom';
export type RotationRange = 360 | 180 | 90 | 45;
/** 动态与功耗（owner 2026-09-05）：auto 跟随系统"减少动态效果"偏好 / 电池状态 */
export type TriState = 'auto' | 'on' | 'off';

export interface ScreensaverSettings {
  mode: ViewMode;
  bodyScale: number;      // 0.6–1.6
  bodyOpacity: number;    // 0.05–0.6（owner 2026-09-05：上限 0.4→0.6，默认 0.16→0.38）
  flowSpeed: number;      // 0.05–1.0（经穴图 1.0 为基准）
  camera: {
    distance: number;     // 0.6–2.0（× 基准距离）
    fov: number;          // 25–70
    orbitSpeed: number;   // 0.02–1.0
    elevation: number;    // 度，-45–75
    inclination: number;  // 度，0–90（球面漂移的起伏幅度）
    orbitStyle: OrbitStyle;
  };
  bodyRotation: {
    speed: number;        // 0.02–1.0
    axisMode: AxisMode;
    yaw: number; pitch: number; roll: number; // 度（自定义）
    range: RotationRange;
  };
  manualInteraction: boolean;
  /** 显示的经络代码（十二正经 + 奇经八脉子集）；空数组＝只留人体 */
  visible: string[];
  /** 时间与声音（时辰经络音景，owner 2026-09-05）：默认关闭；关闭时不影响原有无时间维度的演示 */
  temporal: TemporalSoundscapeSettings;
  /** 减少动态：镜头/自转速度与起伏减半，三轴漂移只留偏航；auto = 跟随 prefers-reduced-motion */
  reducedMotion: TriState;
  /** 省电：像素比 1、约 30 fps；auto = 用电池（未充电）时开启 */
  powerSaver: TriState;
}

export const ALL_MERIDIANS = [...TWELVE, ...VESSELS_EIGHT];

export const DEFAULT_SETTINGS: ScreensaverSettings = {
  mode: 'cameraOrbit',
  bodyScale: 1.0,
  bodyOpacity: 0.38,
  flowSpeed: 0.1,
  camera: { distance: 1.0, fov: 45, orbitSpeed: 0.1, elevation: 8, inclination: 30, orbitStyle: 'spherical' },
  bodyRotation: { speed: 0.25, axisMode: 'xyzDrift', yaw: 0, pitch: 0, roll: 0, range: 360 },
  manualInteraction: false,
  visible: TWELVE,  // 默认只显十二正经；奇经八脉在设置里勾选
  temporal: DEFAULT_TEMPORAL_SETTINGS,
  reducedMotion: 'auto',
  powerSaver: 'auto'
};

const KEY = '3dqiflow:screensaver';

const num = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const pick = <T extends string | number>(v: unknown, allowed: readonly T[], d: T): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : d;

export function loadSettings(): ScreensaverSettings {
  let raw: Partial<ScreensaverSettings> = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { /* 坏值当无 */ }
  const D = DEFAULT_SETTINGS;
  const c = (raw.camera ?? {}) as Partial<ScreensaverSettings['camera']>;
  const b = (raw.bodyRotation ?? {}) as Partial<ScreensaverSettings['bodyRotation']>;
  return {
    mode: pick(raw.mode, ['cameraOrbit', 'bodyRotation', 'combined'] as const, D.mode),
    bodyScale: num(raw.bodyScale, D.bodyScale, 0.6, 1.6),
    bodyOpacity: num(raw.bodyOpacity, D.bodyOpacity, 0.05, 0.6),
    flowSpeed: num(raw.flowSpeed, D.flowSpeed, 0.05, 1),
    camera: {
      distance: num(c.distance, D.camera.distance, 0.6, 2),
      fov: num(c.fov, D.camera.fov, 25, 70),
      orbitSpeed: num(c.orbitSpeed, D.camera.orbitSpeed, 0.02, 1),
      elevation: num(c.elevation, D.camera.elevation, -45, 75),
      inclination: num(c.inclination, D.camera.inclination, 0, 90),
      orbitStyle: pick(c.orbitStyle, ['horizontal', 'elevated', 'spherical', 'free'] as const, D.camera.orbitStyle)
    },
    bodyRotation: {
      speed: num(b.speed, D.bodyRotation.speed, 0.02, 1),
      axisMode: pick(b.axisMode, ['y', 'x', 'z', 'xyzDrift', 'custom'] as const, D.bodyRotation.axisMode),
      yaw: num(b.yaw, 0, -180, 180), pitch: num(b.pitch, 0, -90, 90), roll: num(b.roll, 0, -90, 90),
      range: pick(b.range, [360, 180, 90, 45] as const, D.bodyRotation.range)
    },
    manualInteraction: raw.manualInteraction === true,
    visible: Array.isArray(raw.visible)
      ? ALL_MERIDIANS.filter((c) => (raw.visible as unknown[]).includes(c))
      : D.visible,
    temporal: sanitizeTemporal(raw.temporal),
    reducedMotion: pick(raw.reducedMotion, ['auto', 'on', 'off'] as const, D.reducedMotion),
    powerSaver: pick(raw.powerSaver, ['auto', 'on', 'off'] as const, D.powerSaver)
  };
}

export function sanitizeTemporal(v: unknown): TemporalSoundscapeSettings {
  const t = (v && typeof v === 'object' ? v : {}) as Partial<TemporalSoundscapeSettings>;
  const DT = DEFAULT_TEMPORAL_SETTINGS;
  return {
    enabled: t.enabled === true,
    timeSource: pick(t.timeSource, ['LOCAL_REAL_TIME', 'MANUAL_SHICHEN', 'PREVIEW_24H_CYCLE'] as const, DT.timeSource),
    manualIndex: Math.round(num(t.manualIndex, DT.manualIndex, 0, 11)),
    previewCycleMinutes: num(t.previewCycleMinutes, DT.previewCycleMinutes, 1, 60),
    transitionMinutes: pick(t.transitionMinutes, [5, 10, 15, 20] as const, DT.transitionMinutes),
    masterVolume: num(t.masterVolume, DT.masterVolume, 0, 0.7),
    musicDensity: num(t.musicDensity, DT.musicDensity, 0, 1),
    tonalCenterMidi: num(t.tonalCenterMidi, DT.tonalCenterMidi, 36, 72),
    octaveBias: num(t.octaveBias, DT.octaveBias, -1, 1),
    spatialMode: pick(t.spatialMode, ['OFF', 'SUBTLE', 'FULL'] as const, DT.spatialMode),
    vesselModulation: t.vesselModulation !== false,
    overlay: pick(t.overlay, ['OFF', 'MINIMAL', 'DETAILED'] as const, DT.overlay),
    visualEmphasis: num(t.visualEmphasis, DT.visualEmphasis, 0, 1)
  };
}

export function saveSettings(s: ScreensaverSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 私密模式等 */ }
}
