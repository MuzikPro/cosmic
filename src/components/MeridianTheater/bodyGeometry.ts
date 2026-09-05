/**
 * 十二经剧场的人体骨架与经络曲线（示意图形，非解剖学权威）
 *
 * 布局遵循圆运动教学约定（见 src/data/meridians.ts）：
 *   六升经走观察者左侧（x < 0），六降经走观察者右侧（x > 0）。
 * 同侧的三条经用深度偏移（z）分开，偏移量按五行归属固定。
 */

export type Vec3 = [number, number, number];

/** 人体各部件（供 BodyFigure 渲染） */
export const BODY = {
  head: { position: [0, 3.05, 0] as Vec3, radius: 0.45 },
  neck: { position: [0, 2.68, 0] as Vec3, radius: 0.16, height: 0.35 },
  torso: { position: [0, 1.55, 0] as Vec3, radiusTop: 0.62, radiusBottom: 0.45, height: 1.9 },
  pelvis: { position: [0, 0.45, 0] as Vec3, radius: 0.5, scale: [1.15, 0.6, 0.9] as Vec3 },
  // owner 2026-08-22：四肢锚点改用 Visible Human 皮肤网格实测值
  // （scripts/measure-limbs.py），与解剖体网格同一套比例，
  // 经络四肢段 via 点由同一组轴线推出（见 flowGeometry.ts）。
  limbs: [
    // 左右手臂：肩 → 肘 → 手（实测肩 y2.25 / 肘 y0.85 / 手 y0.03）
    { from: [0.88, 2.25, -0.04] as Vec3, to: [1.22, 0.85, -0.06] as Vec3, r: 0.20 },
    { from: [1.22, 0.85, -0.06] as Vec3, to: [1.70, 0.03, 0.11] as Vec3, r: 0.15 },
    { from: [-0.88, 2.25, -0.04] as Vec3, to: [-1.22, 0.85, -0.06] as Vec3, r: 0.20 },
    { from: [-1.22, 0.85, -0.06] as Vec3, to: [-1.70, 0.03, 0.11] as Vec3, r: 0.15 },
    // 左右腿：髋 → 膝 → 踝（实测髋 y0.10 / 膝 y-1.40 / 踝 y-2.60）
    { from: [0.40, 0.10, -0.05] as Vec3, to: [0.54, -1.40, -0.08] as Vec3, r: 0.30 },
    { from: [0.54, -1.40, -0.08] as Vec3, to: [0.72, -2.60, -0.33] as Vec3, r: 0.25 },
    { from: [-0.40, 0.10, -0.05] as Vec3, to: [-0.54, -1.40, -0.08] as Vec3, r: 0.30 },
    { from: [-0.54, -1.40, -0.08] as Vec3, to: [-0.72, -2.60, -0.33] as Vec3, r: 0.25 }
  ],
  /** 足：实测足长 0.88（z -0.57..0.31）、足宽 0.36 */
  feet: [
    { position: [0.76, -3.05, -0.08] as Vec3 },
    { position: [-0.76, -3.05, -0.08] as Vec3 }
  ],
  footSize: [0.36, 0.3, 0.88] as Vec3
} as const;

/** 相机预设视角（前视/背视/侧视/俯视） */
export const CAMERA_VIEWS = {
  front: [0, 0.5, 9.5] as Vec3,
  back: [0, 0.5, -9.5] as Vec3,
  side: [9.5, 0.5, 0] as Vec3,
  top: [0, 11, 0.1] as Vec3
} as const;

export type CameraViewKey = keyof typeof CAMERA_VIEWS;
