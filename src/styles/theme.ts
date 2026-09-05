/**
 * 全局主题配置 —— 五行五色 + 字体 + 间距
 * 
 * 用法：
 *   import { COLORS, FONTS, SPACING } from '@/styles/theme';
 * 
 * 所有 3D 材质、CSS 样式、UI 组件都必须从这里引用颜色，
 * 禁止在代码中硬编码颜色值。
 */

// ==================== 五行五色 ====================
export const COLORS = {
  // 火
  fire: {
    primary: '#E74C3C',
    secondary: '#C0392B',
    rgb: '231, 76, 60',
    three: 0xE74C3C,
    glow: 'rgba(231, 76, 60, 0.4)',
    light: '#F1948A',
    dark: '#922B21'
  },
  // 木
  wood: {
    primary: '#27AE60',
    secondary: '#2ECC71',
    rgb: '39, 174, 96',
    three: 0x27AE60,
    glow: 'rgba(39, 174, 96, 0.4)',
    light: '#82E0AA',
    dark: '#1E8449'
  },
  // 土
  earth: {
    primary: '#F39C12',
    secondary: '#E67E22',
    rgb: '243, 156, 18',
    three: 0xF39C12,
    glow: 'rgba(243, 156, 18, 0.4)',
    light: '#F7DC6F',
    dark: '#B7950B'
  },
  // 金 —— 2026-08-19 审查修正（review_report D2）：灰白在暗背景下对比度不足，
  // 改为金色主色 + 白色副色（rim）
  metal: {
    primary: '#FFD700',
    secondary: '#ECF0F1',
    rgb: '255, 215, 0',
    three: 0xFFD700,
    secondaryThree: 0xECF0F1,  // 右降轨道用的白色（Three.js 数值）
    glow: 'rgba(255, 215, 0, 0.35)',
    light: '#FFF59D',
    dark: '#B8860B'
  },
  // 水 —— 2026-08-19 审查修正（review_report D1）：深蓝在暗背景下完全不可见，
  // 改为亮天蓝主色 + 深天蓝副色（膀胱）
  water: {
    primary: '#4FC3F7',
    secondary: '#0288D1',
    rgb: '79, 195, 247',
    three: 0x4FC3F7,
    glow: 'rgba(79, 195, 247, 0.4)',
    light: '#B3E5FC',
    dark: '#0288D1'
  },
  // 相火 —— 2026-08-19 审查修正（review_report D3）：深紫偏暗，改为亮紫
  minister: {
    primary: '#CE93D8',
    secondary: '#AB47BC',
    rgb: '206, 147, 216',
    three: 0xCE93D8,
    glow: 'rgba(206, 147, 216, 0.4)',
    light: '#E1BEE7',
    dark: '#8E44AD'
  }
} as const;

// ==================== 五行图例标签 ====================
export const ELEMENT_LABELS: ReadonlyArray<{ key: keyof typeof COLORS; label: string }> = [
  { key: 'fire', label: '心/小肠' },
  { key: 'wood', label: '肝/胆' },
  { key: 'earth', label: '脾胃' },
  { key: 'metal', label: '肺/大肠' },
  { key: 'water', label: '肾/膀胱' },
  { key: 'minister', label: '心包/三焦' }
] as const;

// ==================== UI 叠加层配色（明暗双主题，owner 2026-08-19） ====================
export interface UITheme {
  accent: string;
  panelBg: string;
  panelBgStrong: string;
  panelBorder: string;
  headerGradient: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
}

/** 暗色（默认·宇宙一气） */
export const DARK_UI: UITheme = {
  accent: '#f0c27f',                       // 琥珀高亮（标题/滑块/强调），与中心点光源同色
  panelBg: 'rgba(20,20,40,0.85)',          // 悬浮面板底色
  panelBgStrong: 'rgba(20,20,40,0.9)',     // 信息卡底色
  panelBorder: 'rgba(255,255,255,0.1)',    // 面板描边
  headerGradient: 'linear-gradient(180deg, rgba(10,10,20,0.9) 0%, rgba(10,10,20,0) 100%)',
  // 2026-08-19 owner: 灰阶整体提亮一档——原 #bbb/#aaa/#888/#666 在暗夜底上偏暗
  textPrimary: '#e2e2ea',
  textSecondary: '#c8c8d4',
  textMuted: '#a8a8b8',
  textFaint: '#84849a'
};

/** 亮色（宣纸面板·3D 舞台仍为暗夜，教义色不动） */
export const LIGHT_UI: UITheme = {
  accent: '#a8701d',
  panelBg: 'rgba(245,240,232,0.92)',
  panelBgStrong: 'rgba(248,244,236,0.96)',
  panelBorder: 'rgba(60,50,30,0.22)',
  headerGradient: 'linear-gradient(180deg, rgba(240,235,224,0.96) 0%, rgba(240,235,224,0.88) 55%, rgba(240,235,224,0) 100%)',
  textPrimary: '#26262e',
  textSecondary: '#3d3d4a',
  textMuted: '#5a5a6c',
  textFaint: '#82828f'
};

/**
 * 可变 UI 令牌：全工程组件直接读 UI.xxx。切换主题 = applyUITheme()
 * 就地替换字段值 + App 根节点换 key 强制重挂载。
 */
export const UI: UITheme = { ...DARK_UI };

export function applyUITheme(mode: 'dark' | 'light'): void {
  Object.assign(UI, mode === 'light' ? LIGHT_UI : DARK_UI);
}

/**
 * 画布内文字令牌（3D Html 标签用）：3D 舞台恒为暗夜，
 * 这些颜色不随明暗主题切换，避免亮主题下画布标签变黑不可读。
 */
export const SCENE_TEXT = {
  accent: '#f0c27f',
  muted: '#a8a8b8'
} as const;

// ==================== 太极球壳层配色（3D） ====================
export const SPHERE_SHELL = {
  // 2026-08-19 审查修正 B2：新背景更暗，提亮默认壳色保住"大圆"边界感
  outerDefault: 0x3a3a7e,  // 外层线框球默认色（未选节气时）
  inner: 0x0f0f2e          // 内层实心球
} as const;

// ==================== 全局背景色 ====================
export const BACKGROUND = {
  primary: '#1A1A2E',       // 深空墨色（主背景）
  secondary: '#0F0F1A',     // 更深的背景
  // 2026-08-19 审查修正（review_report D5）：多层径向渐变营造"宇宙一气"氛围
  gradient: [
    'radial-gradient(ellipse at 30% 20%, rgba(142,68,173,0.12) 0%, transparent 50%)',
    'radial-gradient(ellipse at 70% 80%, rgba(46,204,113,0.06) 0%, transparent 40%)',
    'radial-gradient(ellipse at center, #15153a 0%, #080812 60%, #000000 100%)'
  ].join(', '),
  gradient3D: 'radial-gradient(ellipse at center, #16213E 0%, #0F3460 100%)',
  paper: '#F5F0E8',         // 宣纸色（纯文字阅读区）
  paperText: '#3D2B1A'      // 深棕文字（宣纸上的文字）
} as const;

// ==================== 字体 ====================
export const FONTS = {
  title: "'Noto Serif SC', 'Source Han Serif SC', '方正清刻本悦宋', serif",
  body: "'Noto Sans SC', 'Source Han Sans SC', '思源黑体', sans-serif",
  ancient: "'Noto Serif TC', 'KaiTi', '楷体', serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  english: "'Inter', 'PingFang SC', sans-serif"
} as const;

// ==================== 间距 ====================
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px'
} as const;

// ==================== 圆角 ====================
export const RADIUS = {
  sm: '6px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  pill: '999px'
} as const;

// ==================== 阴影 ====================
export const SHADOWS = {
  sm: '0 2px 8px rgba(0,0,0,0.2)',
  md: '0 4px 16px rgba(0,0,0,0.3)',
  lg: '0 8px 32px rgba(0,0,0,0.4)',
  glow: {
    fire: '0 0 20px rgba(231,76,60,0.3)',
    wood: '0 0 20px rgba(39,174,96,0.3)',
    earth: '0 0 20px rgba(243,156,18,0.3)',
    metal: '0 0 20px rgba(236,240,241,0.2)',
    water: '0 0 20px rgba(52,152,219,0.3)',
    minister: '0 0 20px rgba(142,68,173,0.3)'
  }
} as const;

// ==================== 3D 场景默认配置 ====================
export const THREE_DEFAULTS = {
  camera: {
    fov: 50,
    near: 0.1,
    far: 1000,
    position: [0, 2, 14] as [number, number, number]
  },
  fog: {
    color: 0x0a0a1a,
    density: 0.02
  },
  lights: {
    ambient: { color: 0x404060, intensity: 0.6 },
    center: { color: 0xf0c27f, intensity: 1.5, distance: 20 },
    top: { color: 0xe74c3c, intensity: 0.8, distance: 15 },
    bottom: { color: 0x3498db, intensity: 0.6, distance: 15 }
  },
  particle: {
    count: 600,
    size: 0.08,
    opacity: 0.8,
    blending: 'additive'
  },
  orbitControls: {
    enableDamping: true,
    dampingFactor: 0.08,
    autoRotate: true,
    autoRotateSpeed: 0.5,
    minDistance: 6,
    maxDistance: 25
  }
} as const;

// ==================== 工具函数 ====================

/**
 * 根据五行获取颜色对象
 */
export function getColorByElement(element: keyof typeof COLORS) {
  return COLORS[element];
}

/**
 * 获取 Three.js 可用的颜色值
 */
export function getThreeColor(element: keyof typeof COLORS): number {
  return COLORS[element].three;
}

/**
 * 获取 CSS 可用的颜色值
 */
export function getCssColor(element: keyof typeof COLORS): string {
  return COLORS[element].primary;
}

/**
 * 生成五行渐变字符串（用于 CSS）
 */
export function getFiveElementGradient(): string {
  return `linear-gradient(135deg, 
    ${COLORS.wood.primary} 0%, 
    ${COLORS.fire.primary} 25%, 
    ${COLORS.earth.primary} 50%, 
    ${COLORS.metal.primary} 75%, 
    ${COLORS.water.primary} 100%)`;
}
