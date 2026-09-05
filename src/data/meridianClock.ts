/**
 * 子午流注 · 十二时辰经络当令表（owner 2026-08-19 需求：轴轮模型实时时辰条）
 *
 * 传统十二时辰配十二经（子胆丑肝……戌心包亥三焦），为经典通行内容，
 * 属教学展示，非诊疗依据。organ 与 src/data/organs.ts、meridian 与
 * src/data/meridians.ts 的名称一一对应，供 3D 高亮与经络剧场深链。
 *
 * 节气"今日"推算：二十四节气由太阳黄经决定，只随日期/时区变化，
 * 与地理位置无关（无需定位权限）。下表为常年近似交节日（±1 天浮动），
 * 教学用途足够；精确交节时刻逐年不同。
 */
import { SOLAR_TERMS } from './solarTerms';

/** 五行（五音归类用：心/小肠与心包/三焦同属火，见 ministerFire） */
export type FiveElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
/** 五音：宫商角徵羽——相对的调式功能，不是固定的西方音高 */
export type FiveTone = 'gong' | 'shang' | 'jue' | 'zhi' | 'yu';
export type Polarity = 'yin' | 'yang';

export interface ShichenEntry {
  shichen: string;   // 时辰名
  pinyin: string;    // 地支拼音（Zi…Hai）
  hours: string;     // 现代钟点区间
  startHour: number; // 区间起点（24h 制；子时=23）
  organ: string;     // 对应脏腑（ORGANS.name）
  meridian: string;  // 对应经络（MERIDIAN_FLOW.name）
  meridianFull: string;
  note: string;      // 一句当令提示（经典通说）
  /** 经络码（与 pointGeometry.TWELVE / acupoints.MERIDIAN_META 同一套） */
  code: string;
  /** 五行归类（《素问》五音配五脏：宫土脾 商金肺 角木肝 徵火心 羽水肾；腑随其表里之脏） */
  element: FiveElement;
  tone: FiveTone;
  polarity: Polarity;
  /** 相火（心包/三焦）：五音同属徵，配色与音色另作区分 */
  ministerFire: boolean;
}

export const MERIDIAN_CLOCK: ShichenEntry[] = [
  { shichen: '子', pinyin: 'Zi', hours: '23–01', startHour: 23, organ: '胆', meridian: '胆经', meridianFull: '足少阳胆经', note: '一阳初生，胆气生发',
    code: 'GB', element: 'wood', tone: 'jue', polarity: 'yang', ministerFire: false },
  { shichen: '丑', pinyin: 'Chou', hours: '01–03', startHour: 1, organ: '肝', meridian: '肝经', meridianFull: '足厥阴肝经', note: '肝藏血，血归于肝',
    code: 'LR', element: 'wood', tone: 'jue', polarity: 'yin', ministerFire: false },
  { shichen: '寅', pinyin: 'Yin', hours: '03–05', startHour: 3, organ: '肺', meridian: '肺经', meridianFull: '手太阴肺经', note: '气血注肺，肺朝百脉',
    code: 'LU', element: 'metal', tone: 'shang', polarity: 'yin', ministerFire: false },
  { shichen: '卯', pinyin: 'Mao', hours: '05–07', startHour: 5, organ: '大肠', meridian: '大肠经', meridianFull: '手阳明大肠经', note: '大肠传导，排浊之时',
    code: 'LI', element: 'metal', tone: 'shang', polarity: 'yang', ministerFire: false },
  { shichen: '辰', pinyin: 'Chen', hours: '07–09', startHour: 7, organ: '胃', meridian: '胃经', meridianFull: '足阳明胃经', note: '胃受纳，宜进早餐',
    code: 'ST', element: 'earth', tone: 'gong', polarity: 'yang', ministerFire: false },
  { shichen: '巳', pinyin: 'Si', hours: '09–11', startHour: 9, organ: '脾', meridian: '脾经', meridianFull: '足太阴脾经', note: '脾主运化，中轴最旺',
    code: 'SP', element: 'earth', tone: 'gong', polarity: 'yin', ministerFire: false },
  { shichen: '午', pinyin: 'Wu', hours: '11–13', startHour: 11, organ: '心', meridian: '心经', meridianFull: '手少阴心经', note: '心气宣通，阳气之极',
    code: 'HT', element: 'fire', tone: 'zhi', polarity: 'yin', ministerFire: false },
  { shichen: '未', pinyin: 'Wei', hours: '13–15', startHour: 13, organ: '小肠', meridian: '小肠经', meridianFull: '手太阳小肠经', note: '小肠泌别清浊',
    code: 'SI', element: 'fire', tone: 'zhi', polarity: 'yang', ministerFire: false },
  { shichen: '申', pinyin: 'Shen', hours: '15–17', startHour: 15, organ: '膀胱', meridian: '膀胱经', meridianFull: '足太阳膀胱经', note: '膀胱气化行水',
    code: 'BL', element: 'water', tone: 'yu', polarity: 'yang', ministerFire: false },
  { shichen: '酉', pinyin: 'You', hours: '17–19', startHour: 17, organ: '肾', meridian: '肾经', meridianFull: '足少阴肾经', note: '肾藏精，封藏之本',
    code: 'KI', element: 'water', tone: 'yu', polarity: 'yin', ministerFire: false },
  { shichen: '戌', pinyin: 'Xu', hours: '19–21', startHour: 19, organ: '心包', meridian: '心包经', meridianFull: '手厥阴心包经', note: '心包护心，相火下行',
    code: 'PC', element: 'fire', tone: 'zhi', polarity: 'yin', ministerFire: true },
  { shichen: '亥', pinyin: 'Hai', hours: '21–23', startHour: 21, organ: '三焦', meridian: '三焦经', meridianFull: '手少阳三焦经', note: '三焦通调，百脉归息',
    code: 'TE', element: 'fire', tone: 'zhi', polarity: 'yang', ministerFire: true }
];

/** 五音表：宫商角徵羽 → 五行 → 所属经络码。相对调式功能，整体可移调；不写死"宫=D"之类的绝对音高。 */
export const FIVE_TONES: Record<FiveTone, { zh: string; pinyin: string; element: FiveElement; codes: string[] }> = {
  gong:  { zh: '宫', pinyin: 'Gong',  element: 'earth', codes: ['ST', 'SP'] },
  shang: { zh: '商', pinyin: 'Shang', element: 'metal', codes: ['LU', 'LI'] },
  jue:   { zh: '角', pinyin: 'Jue',   element: 'wood',  codes: ['GB', 'LR'] },
  zhi:   { zh: '徵', pinyin: 'Zhi',   element: 'fire',  codes: ['HT', 'SI', 'PC', 'TE'] },
  yu:    { zh: '羽', pinyin: 'Yu',    element: 'water', codes: ['BL', 'KI'] }
};

/** 表里配对（同一五行、钟面相邻的一升一降） */
export const MERIDIAN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['LU', 'LI'], ['ST', 'SP'], ['HT', 'SI'], ['BL', 'KI'], ['PC', 'TE'], ['GB', 'LR']
];
export function partnerOf(code: string): string | null {
  for (const [a, b] of MERIDIAN_PAIRS) { if (a === code) return b; if (b === code) return a; }
  return null;
}
export function clockEntryForCode(code: string): ShichenEntry | undefined {
  return MERIDIAN_CLOCK.find((e) => e.code === code);
}

/** 当前时辰索引（子时跨 23:00–01:00） */
export function currentShichenIndex(date: Date = new Date()): number {
  return Math.floor(((date.getHours() + 1) % 24) / 2);
}

/** 常年近似交节日（月, 日），按节气名索引 */
const TERM_DATES: Record<string, [number, number]> = {
  立春: [2, 4], 雨水: [2, 19], 惊蛰: [3, 6], 春分: [3, 21], 清明: [4, 5], 谷雨: [4, 20],
  立夏: [5, 6], 小满: [5, 21], 芒种: [6, 6], 夏至: [6, 21], 小暑: [7, 7], 大暑: [7, 23],
  立秋: [8, 8], 处暑: [8, 23], 白露: [9, 8], 秋分: [9, 23], 寒露: [10, 8], 霜降: [10, 24],
  立冬: [11, 7], 小雪: [11, 22], 大雪: [12, 7], 冬至: [12, 22], 小寒: [1, 6], 大寒: [1, 20]
};

/** 今日所属节气在 SOLAR_TERMS 中的索引（近似±1天） */
export function currentSolarTermIndex(date: Date = new Date()): number {
  const value = (m: number, d: number) => m * 100 + d;
  const today = value(date.getMonth() + 1, date.getDate());
  let bestIndex = 0;
  let bestValue = -1;
  SOLAR_TERMS.forEach((term, i) => {
    const md = TERM_DATES[term.name];
    if (!md) return;
    const v = value(md[0], md[1]);
    if (v <= today && v > bestValue) {
      bestValue = v;
      bestIndex = i;
    }
  });
  if (bestValue === -1) {
    // 年初 1/1–1/5：仍属去年冬至节气区间
    const winterSolstice = SOLAR_TERMS.findIndex((t) => t.name === '冬至');
    return winterSolstice >= 0 ? winterSolstice : 0;
  }
  return bestIndex;
}
