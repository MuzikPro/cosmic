/**
 * 宇宙经络屏保的设置（owner 2026-09-05）：只存用户配置，不存每帧镜头值。
 * 键 3dqiflow:screensaver；缺项按默认补齐，坏值不炸。
 */
import { TWELVE, VESSELS_EIGHT } from '../Acupoints/pointGeometry';

export type ViewMode = 'cameraOrbit' | 'bodyRotation' | 'combined';
export type OrbitStyle = 'horizontal' | 'elevated' | 'spherical' | 'free';
export type AxisMode = 'y' | 'x' | 'z' | 'xyzDrift' | 'custom';
export type RotationRange = 360 | 180 | 90 | 45;

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
  visible: TWELVE   // 默认只显十二正经；奇经八脉在设置里勾选
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
      : D.visible
  };
}

export function saveSettings(s: ScreensaverSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 私密模式等 */ }
}
