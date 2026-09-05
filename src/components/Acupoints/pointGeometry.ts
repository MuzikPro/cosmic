import { ACUPOINTS, MERIDIAN_META, Acupoint } from '@/data/acupoints';
import { DERIVED_POINTS } from '@/data/acupointsDerived';
import { MERIDIAN_ROUTES, MERIDIAN_ROUTES_M } from '@/data/meridianRoutes';
import { DERIVED_POINTS as DERIVED_POINTS_F } from '@/data/acupointsDerivedFemale';
import { MERIDIAN_ROUTES as MERIDIAN_ROUTES_F,
         MERIDIAN_ROUTES_M as MERIDIAN_ROUTES_FM } from '@/data/meridianRoutesFemale';

/** 男/女两具体表各有一套逐穴推导位：女体是按**她自己**的骨性标志重推的，
 *  不是把男体坐标搬过去（那样实测中位偏 12.8 mm、踝周最远 74 mm）。
 *  生成见 scripts/：BODY=female 走同一条链。 */
export type BodySexKey = 'male' | 'female';
import { COLORS } from '@/styles/theme';

export type Vec3 = [number, number, number];

/** 五行 → 经脉线色（沿用本项目 theme 五行色，不另立配色） */
const ELEMENT_COLOR: Record<string, string> = {
  metal: COLORS.metal.primary,
  earth: COLORS.earth.primary,
  fire: COLORS.fire.primary,
  water: COLORS.water.primary,
  wood: COLORS.wood.primary
};
export const meridianColor = (code: string): string => {
  const v = VESSEL_BY_CODE.get(code);
  if (v) return v.color;
  const m = MERIDIAN_META.find((x) => x.code === code);
  return (m && ELEMENT_COLOR[m.element]) || COLORS.minister.primary;
};

/**
 * 气机运行方向（《靈樞·逆順肥瘦》：手之三陰從臟走手，手之三陽從手走頭，
 * 足之三陽從頭走足，足之三陰從足走腹）。
 * 数据里的穴序本就依此排（如 LU1 中府在胸 → LU11 少商在拇指），
 * 故动画沿穴序推进即为正确方向，无须另设方向字段。
 */
export function flowLabel(code: string): string {
  const v = VESSEL_BY_CODE.get(code);
  if (v) return v.flow;
  const m = MERIDIAN_META.find((x) => x.code === code);
  if (!m) return '';
  // 任/督属奇经八脉，不适用"手足三阴三阳"那条规则，须单列，
  // 否则会被下面的判断兜底成错的方向
  if (code === 'CV') return '沿前正中线上行';
  if (code === 'GV') return '沿后正中线上行';
  const hand = m.zh.startsWith('手');
  const yin = m.zh.includes('陰');
  if (hand && yin) return '从胸走手';
  if (hand && !yin) return '从手走头';
  if (!hand && !yin) return '从头走足';
  if (!hand && yin) return '从足走胸腹';
  return '';
}

/** 十二正经（任/督为奇经，另计） */
export const TWELVE = ['LU', 'LI', 'ST', 'SP', 'HT', 'SI', 'BL', 'KI', 'PC', 'TE', 'GB', 'LR'];
export const EXTRA = ['CV', 'GV'];

// 十二经的四种常用分组（顺序与 TWELVE 一致，便于对照阅读）。
// 手/足按经名首字；阴阳按 太阴·少阴·厥阴 为阴、阳明·太阳·少阳 为阳。
// 任督为奇经，不入这四组——「加任督」另有按钮。
/** 奇经八脉：任督沿用 CV/GV（有本经穴），其余六脉无本经穴，
 *  走线取通行教材交会穴序列（见 build-meridian-routes.py），仍属教学示意。
 *  配色取自 theme 五行色的深浅变体（不引入外来色）：
 *  阴脉取浅、阳脉取深；冲=血海取火之浅、带=约束取相火之深。 */
export const VESSEL_SIX = ['CHONG', 'DAI', 'YINQIAO', 'YANGQIAO', 'YINWEI', 'YANGWEI'];
export const VESSELS_EIGHT = ['CV', 'GV', ...VESSEL_SIX];
/** 不做左右镜像的经：任督在正中，带脉本身就是绕身闭环 */
export const NO_MIRROR = new Set(['CV', 'GV', 'DAI']);

/**
 * 六条奇经的交会穴序列（DELIVERY_QIJING 交付，与 scripts/build-meridian-routes.py
 * 的 VESSELS 表逐字一致——路线即按此序生成）。奇经除任督外无本经穴，
 * 显示时借这些点：借来仍属其本经，信息卡如实标注。
 */
export const VESSEL_POINTS: Record<string, string[]> = {
  CHONG: ['CV1', 'ST30', 'KI11', 'KI12', 'KI13', 'KI14', 'KI15', 'KI16',
          'KI17', 'KI18', 'KI19', 'KI20', 'KI21'],
  DAI: ['LR13', 'GB26', 'GB27', 'GB28'],
  YINQIAO: ['KI6', 'KI8', 'BL1'],
  YANGQIAO: ['BL62', 'BL61', 'BL59', 'GB29', 'SI10', 'LI15', 'LI16',
             'ST4', 'ST3', 'ST1', 'BL1', 'GB20'],
  YINWEI: ['KI9', 'SP13', 'SP15', 'SP16', 'LR14', 'CV22', 'CV23'],
  YANGWEI: ['BL63', 'GB35', 'SI10', 'TE15', 'GB21', 'ST8', 'GB13',
            'GB14', 'GB15', 'GB16', 'GB17', 'GB18', 'GB19', 'GB20',
            'GV16', 'GV15']
};

/** 某穴被哪些奇经所过（0-2 条；信息卡「交会穴」行用） */
export function vesselsThrough(code: string): string[] {
  return Object.keys(VESSEL_POINTS).filter((v) => VESSEL_POINTS[v].includes(code));
}

export interface VesselMeta {
  code: string;
  zh: string;
  color: string;
  flow: string;
  /** 交会穴数（奇经无本经穴，列表右侧显示交会穴数） */
  count: number;
  summary: string;
}
export const VESSEL_META: VesselMeta[] = [
  { code: 'CHONG', zh: '衝脈', color: COLORS.fire.light, count: 13,
    flow: '起胞中，挟脐上行', summary: '十二经脉之海、血海——上至头、下至足，蓄溢诸经气血。' },
  { code: 'DAI', zh: '帶脈', color: COLORS.minister.dark, count: 4,
    flow: '起季胁，绕腰一周', summary: '约束纵行诸脉，如束带然。' },
  { code: 'YINQIAO', zh: '陰蹻脈', color: COLORS.water.light, count: 3,
    flow: '从内踝走目内眦', summary: '起于照海，主司眼睑开合与下肢运动（阴侧）。' },
  // 陽蹻/陽維原用 water.dark/wood.dark——深色调在深蓝体表上近乎隐形
  // （owner 2026-08-26 报「阳跷线丢失」，实为线在而不可见）。改亮色调：
  // 亮青对肾/膀胱天蓝、黄绿对肝/胆正绿，同族有别且看得见。
  { code: 'YANGQIAO', zh: '陽蹻脈', color: '#00E5FF', count: 12,
    flow: '从外踝走项后', summary: '起于申脉，主司眼睑开合与下肢运动（阳侧）。' },
  { code: 'YINWEI', zh: '陰維脈', color: COLORS.wood.light, count: 7,
    flow: '从小腿内侧走颈前', summary: '起于筑宾，维络诸阴。' },
  { code: 'YANGWEI', zh: '陽維脈', color: '#9CCC65', count: 16,
    flow: '从外踝走项后', summary: '起于金门，维络诸阳。' }
];
const VESSEL_BY_CODE = new Map(VESSEL_META.map((v) => [v.code, v]));

export const HAND_SIX = ['LU', 'LI', 'HT', 'SI', 'PC', 'TE'];
export const FOOT_SIX = ['ST', 'SP', 'BL', 'KI', 'GB', 'LR'];
export const YANG_SIX = ['LI', 'ST', 'SI', 'BL', 'TE', 'GB'];
export const YIN_SIX = ['LU', 'SP', 'HT', 'KI', 'PC', 'LR'];

export interface PlacedPoint extends Acupoint {
  /** 以奇经交会穴身份显示时：该奇经码（点本属其 meridian，仅借来显示） */
  viaVessel?: string;
  /** 实际渲染位置：双侧经左右各生成一份，正中线穴只有一份 */
  at: Vec3;
  mirrored: boolean;
  key: string;
  /** 该穴是否为逐穴按骨度推导（目前仅肺经），否则为整经重定位 */
  derived: boolean;
  /** 推导所用规则（仅 derived 时有） */
  rule?: string;
  deriveNote?: string;
}

/** 该经逐穴推导的比例（用于在列表里如实标出哪几经已逐条推导） */
export function derivedRatio(code: string): { done: number; total: number } {
  const total = ACUPOINTS.filter((p) => p.meridian === code).length;
  const done = ACUPOINTS.filter((p) => p.meridian === code && DERIVED.has(p.code)).length;
  return { done, total };
}

/** 逐穴推导位优先（其余仍为整经重定位，见 acupointsDerived.ts 头部说明） */
const DERIVED = new Map(DERIVED_POINTS.map((d) => [d.code, d]));
const DERIVED_F = new Map(DERIVED_POINTS_F.map((d) => [d.code, d]));
const derivedMap = (sex: BodySexKey) => (sex === 'female' ? DERIVED_F : DERIVED);
const routesOf = (sex: BodySexKey) => (sex === 'female' ? MERIDIAN_ROUTES_F : MERIDIAN_ROUTES);
const routesMirrorOf = (sex: BodySexKey) =>
  (sex === 'female' ? MERIDIAN_ROUTES_FM : MERIDIAN_ROUTES_M);

export const derivedPos = (code: string, sex: BodySexKey = 'male'): Vec3 | null => {
  const d = derivedMap(sex).get(code);
  return d ? (d.pos as Vec3) : null;
};

/** 源数据把双侧穴只存一侧（2D 图为避免重叠）；人体上应左右各有一条 */
export function placedPoints(sex: BodySexKey = 'male'): PlacedPoint[] {
  const out: PlacedPoint[] = [];
  const map = derivedMap(sex);
  for (const p of ACUPOINTS) {
    const d = map.get(p.code);
    const base: Vec3 = d ? (d.pos as Vec3) : (p.pos as Vec3);
    const meta = { derived: !!d, rule: d?.rule, deriveNote: d?.note };
    out.push({ ...p, ...meta, at: base, mirrored: false, key: p.code });
    if (p.side !== 'midline') {
      // 对侧优先用 posM（镜像后吸附到对侧真实体表）：身体并不左右对称，
      // 女体两腿差约 12 mm，裸 -x 镜像会让整排穴浮在腿外或埋进腿里
      const atM: Vec3 = (d?.posM as Vec3) ?? [-base[0], base[1], base[2]];
      out.push({ ...p, ...meta, at: atM, mirrored: true, key: p.code + '-m' });
    }
  }
  return out;
}

/**
 * 一条经在某一侧的走线。
 *
 * 只用穴点当控制点时，样条会在相邻两穴隔得远又拐得急的地方甩出体外
 * （肩井→淵腋曾离体 0.33）。meridianRoutes.ts 里是加密并压到体表之后的
 * 控制点，优先用它；中间点不是穴位，只负责把线拽在身上。
 */
export function meridianPolyline(code: string, mirrored: boolean,
                                 sex: BodySexKey = 'male'): Vec3[] {
  if (mirrored && NO_MIRROR.has(code)) return [];
  const route = (mirrored ? routesMirrorOf(sex)[code] : routesOf(sex)[code]);
  if (route && route.length > 1) {
    // 相邻重复点剔除：奇经镜像路线里近六成是原地重复点（阳跷 1239 点中
    // 737 个与前一点重合），喂给 CatmullRom+Tube 后浏览器端整管静默不画
    // （几何数值全对、场景状态全对，唯独不出画——owner 2026-08-26 实测）。
    // 去重后与本侧同量级，恢复正常绘制，对干净路线无影响。
    const out: Vec3[] = [];
    for (const b of route) {
      const prev = out[out.length - 1];
      if (!prev || Math.abs(prev[0] - b[0]) + Math.abs(prev[1] - b[1]) + Math.abs(prev[2] - b[2]) > 1e-6) {
        out.push(b as Vec3);
      }
    }
    if (out.length > 1) return out;
  }
  const num = (c: string) => parseInt(c.replace(/^[A-Z]+/, ''), 10);
  return ACUPOINTS.filter((p) => p.meridian === code)
    .filter((p) => (p.side === 'midline' ? !mirrored : true))
    .sort((a, b) => num(a.code) - num(b.code))
    .map((p) => {
      const b = derivedPos(p.code, sex) ?? (p.pos as Vec3);
      return (mirrored && p.side !== 'midline' ? ([-b[0], b[1], b[2]] as Vec3) : b);
    });
}
