/**
 * 二十四节气数据 —— 一气周流
 * 
 * 用法：
 *   import { SOLAR_TERMS, getSeasonByName } from '@/data/solarTerms';
 * 
 * 在 3D 节气剧场中：
 *   - 24 个节气节点均匀分布在 3D 环形时间轴上
 *   - 拖动滑块 → 太极球颜色随之变化
 *   - 自动播放 → 展示一整年气机周流
 */

export interface SolarTerm {
  name: string;       // 节气名
  desc: string;       // 描述
  qi: ElementKey;     // 对应五行气
  color: number;      // Three.js Hex 颜色
  colorHex: string;   // CSS 颜色
  gua?: string;       // 对应消息卦
  yangCount?: number; // 阳爻数
  yinCount?: number;  // 阴爻数
  bodyPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export type ElementKey = 'fire' | 'wood' | 'earth' | 'metal' | 'water' | 'minister';

/**
 * 十二消息卦与节气的对应关系
 * 复→临→泰→大壮→夬→乾→姤→遁→否→观→剥→坤
 */
const GUA_MAP: Record<number, { name: string; yang: number; yin: number }> = {
  0:  { name: '复卦',   yang: 1, yin: 5 },  // 冬至一阳生
  1:  { name: '复卦',   yang: 1, yin: 5 },
  2:  { name: '临卦',   yang: 2, yin: 4 },
  3:  { name: '泰卦',   yang: 3, yin: 3 },
  4:  { name: '大壮',   yang: 4, yin: 2 },
  5:  { name: '夬卦',   yang: 5, yin: 1 },
  6:  { name: '乾卦',   yang: 6, yin: 0 },
  7:  { name: '乾卦',   yang: 6, yin: 0 },
  8:  { name: '乾卦',   yang: 6, yin: 0 },
  9:  { name: '姤卦',   yang: 5, yin: 1 },  // 夏至一阴生
  10: { name: '姤卦',   yang: 5, yin: 1 },
  11: { name: '遁卦',   yang: 4, yin: 2 },
  12: { name: '否卦',   yang: 3, yin: 3 },
  13: { name: '否卦',   yang: 3, yin: 3 },
  14: { name: '观卦',   yang: 2, yin: 4 },
  15: { name: '观卦',   yang: 2, yin: 4 },
  16: { name: '剥卦',   yang: 1, yin: 5 },
  17: { name: '剥卦',   yang: 1, yin: 5 },
  18: { name: '坤卦',   yang: 0, yin: 6 },
  19: { name: '坤卦',   yang: 0, yin: 6 },
  20: { name: '坤卦',   yang: 0, yin: 6 },
  21: { name: '复卦',   yang: 1, yin: 5 },
  22: { name: '复卦',   yang: 1, yin: 5 },
  23: { name: '复卦',   yang: 1, yin: 5 },
};

/**
 * 二十四节气完整数据
 * 
 * 气机流转逻辑：
 *   春(木·左升) → 夏(火·上宣) → 秋(金·右降) → 冬(水·下藏) → 循环
 */
export const SOLAR_TERMS: SolarTerm[] = [
  // ===== 春·木气升发（左升之路） =====
  { name: '立春', desc: '阳气始升',     qi: 'wood',  color: 0x27AE60, colorHex: '#27AE60', gua: GUA_MAP[0].name, yangCount: GUA_MAP[0].yang, yinCount: GUA_MAP[0].yin,  bodyPosition: 'left'  },
  { name: '雨水', desc: '木气疏泄',     qi: 'wood',  color: 0x27AE60, colorHex: '#27AE60', gua: GUA_MAP[1].name, yangCount: GUA_MAP[1].yang, yinCount: GUA_MAP[1].yin,  bodyPosition: 'left'  },
  { name: '惊蛰', desc: '雷动木旺',     qi: 'wood',  color: 0x2ECC71, colorHex: '#2ECC71', gua: GUA_MAP[2].name, yangCount: GUA_MAP[2].yang, yinCount: GUA_MAP[2].yin,  bodyPosition: 'left'  },
  { name: '春分', desc: '阴阳各半',     qi: 'wood',  color: 0x2ECC71, colorHex: '#2ECC71', gua: GUA_MAP[3].name, yangCount: GUA_MAP[3].yang, yinCount: GUA_MAP[3].yin,  bodyPosition: 'left'  },
  { name: '清明', desc: '木火之交',     qi: 'wood',  color: 0x27AE60, colorHex: '#27AE60', gua: GUA_MAP[4].name, yangCount: GUA_MAP[4].yang, yinCount: GUA_MAP[4].yin,  bodyPosition: 'left'  },
  { name: '谷雨', desc: '土气渐旺',     qi: 'earth', color: 0xF39C12, colorHex: '#F39C12', gua: GUA_MAP[5].name, yangCount: GUA_MAP[5].yang, yinCount: GUA_MAP[5].yin,  bodyPosition: 'center'},

  // ===== 夏·火气宣通（上宣之路） =====
  { name: '立夏', desc: '火气宣通',     qi: 'fire',  color: 0xE74C3C, colorHex: '#E74C3C', gua: GUA_MAP[6].name, yangCount: GUA_MAP[6].yang, yinCount: GUA_MAP[6].yin,  bodyPosition: 'top'   },
  { name: '小满', desc: '火气渐盛',     qi: 'fire',  color: 0xE74C3C, colorHex: '#E74C3C', gua: GUA_MAP[7].name, yangCount: GUA_MAP[7].yang, yinCount: GUA_MAP[7].yin,  bodyPosition: 'top'   },
  { name: '芒种', desc: '土旺寄位',     qi: 'earth', color: 0xF39C12, colorHex: '#F39C12', gua: GUA_MAP[8].name, yangCount: GUA_MAP[8].yang, yinCount: GUA_MAP[8].yin,  bodyPosition: 'center'},
  { name: '夏至', desc: '阳极转降',     qi: 'fire',  color: 0xC0392B, colorHex: '#C0392B', gua: GUA_MAP[9].name, yangCount: GUA_MAP[9].yang, yinCount: GUA_MAP[9].yin,  bodyPosition: 'top'   },
  { name: '小暑', desc: '火气未退',     qi: 'fire',  color: 0xE74C3C, colorHex: '#E74C3C', gua: GUA_MAP[10].name, yangCount: GUA_MAP[10].yang, yinCount: GUA_MAP[10].yin, bodyPosition: 'top'   },
  { name: '大暑', desc: '湿热极盛',     qi: 'fire',  color: 0xC0392B, colorHex: '#C0392B', gua: GUA_MAP[11].name, yangCount: GUA_MAP[11].yang, yinCount: GUA_MAP[11].yin, bodyPosition: 'top'   },

  // ===== 秋·金气收敛（右降之路） =====
  { name: '立秋', desc: '金气始收',     qi: 'metal', color: 0xBDC3C7, colorHex: '#BDC3C7', gua: GUA_MAP[12].name, yangCount: GUA_MAP[12].yang, yinCount: GUA_MAP[12].yin, bodyPosition: 'right' },
  { name: '处暑', desc: '暑气渐消',     qi: 'metal', color: 0xECF0F1, colorHex: '#ECF0F1', gua: GUA_MAP[13].name, yangCount: GUA_MAP[13].yang, yinCount: GUA_MAP[13].yin, bodyPosition: 'right' },
  { name: '白露', desc: '金气肃降',     qi: 'metal', color: 0xBDC3C7, colorHex: '#BDC3C7', gua: GUA_MAP[14].name, yangCount: GUA_MAP[14].yang, yinCount: GUA_MAP[14].yin, bodyPosition: 'right' },
  { name: '秋分', desc: '阴阳各半',     qi: 'metal', color: 0x95A5A6, colorHex: '#95A5A6', gua: GUA_MAP[15].name, yangCount: GUA_MAP[15].yang, yinCount: GUA_MAP[15].yin, bodyPosition: 'right' },
  { name: '寒露', desc: '金水之交',     qi: 'metal', color: 0x7F8C8D, colorHex: '#7F8C8D', gua: GUA_MAP[16].name, yangCount: GUA_MAP[16].yang, yinCount: GUA_MAP[16].yin, bodyPosition: 'right' },
  { name: '霜降', desc: '金气极收',     qi: 'water', color: 0x3498DB, colorHex: '#3498DB', gua: GUA_MAP[17].name, yangCount: GUA_MAP[17].yang, yinCount: GUA_MAP[17].yin, bodyPosition: 'bottom' },

  // ===== 冬·水气封藏（下藏之路） =====
  { name: '立冬', desc: '水气始藏',     qi: 'water', color: 0x0288D1, colorHex: '#0288D1', gua: GUA_MAP[18].name, yangCount: GUA_MAP[18].yang, yinCount: GUA_MAP[18].yin, bodyPosition: 'bottom' },
  { name: '小雪', desc: '阳气封藏',     qi: 'water', color: 0x0288D1, colorHex: '#0288D1', gua: GUA_MAP[19].name, yangCount: GUA_MAP[19].yang, yinCount: GUA_MAP[19].yin, bodyPosition: 'bottom' },
  { name: '大雪', desc: '水气旺极',     qi: 'water', color: 0x01579B, colorHex: '#01579B', gua: GUA_MAP[20].name, yangCount: GUA_MAP[20].yang, yinCount: GUA_MAP[20].yin, bodyPosition: 'bottom' },
  { name: '冬至', desc: '阴极转升',     qi: 'water', color: 0x01579B, colorHex: '#01579B', gua: GUA_MAP[21].name, yangCount: GUA_MAP[21].yang, yinCount: GUA_MAP[21].yin, bodyPosition: 'bottom' },
  { name: '小寒', desc: '寒水封藏',     qi: 'water', color: 0x0288D1, colorHex: '#0288D1', gua: GUA_MAP[22].name, yangCount: GUA_MAP[22].yang, yinCount: GUA_MAP[22].yin, bodyPosition: 'bottom' },
  { name: '大寒', desc: '阳气潜藏',     qi: 'water', color: 0x0277BD, colorHex: '#0277BD', gua: GUA_MAP[23].name, yangCount: GUA_MAP[23].yang, yinCount: GUA_MAP[23].yin, bodyPosition: 'bottom' },
];

/**
 * 按名称查找节气
 */
export function getSeasonByName(name: string): SolarTerm | undefined {
  return SOLAR_TERMS.find(s => s.name === name);
}

/**
 * 获取节气在环上的 3D 坐标
 * @param index 节气索引 (0-23)
 * @param radius 环半径
 */
export function getSeasonPosition(index: number, radius: number = 7): [number, number, number] {
  const angle = (index / 24) * Math.PI * 2;
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.5,  // 椭圆
    Math.sin(angle * 0.5) * 1.5       // Z 轴波动
  ];
}

/**
 * 节气分段（用于 3D 剧场的大段落切换）
 */
export const SEASON_PHASES = {
  spring: { start: 0,  end: 5,  label: '春·木气升发',  color: '#27AE60' },
  summer: { start: 6,  end: 11, label: '夏·火气宣通',  color: '#E74C3C' },
  autumn: { start: 12, end: 17, label: '秋·金气收敛',  color: '#ECF0F1' },
  winter: { start: 18, end: 23, label: '冬·水气封藏',  color: '#0288D1' },
} as const;
