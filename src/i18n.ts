/**
 * 界面多语言（owner 2026-08-19：中文/English/日本語）。
 *
 * 范围界定：本表只覆盖 UI 骨架（标题/导航/设置/引导按钮等）。
 * 内容数据（96 条文、39 方剂、语录等经典文本与交付解读）不做机器
 * 翻译——项目规则"不虚构翻译"；待有真实译本再接入。
 */
export type Lang = 'zh' | 'en' | 'ja';

export const LANGS: Array<{ key: Lang; label: string }> = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' }
];

const STRINGS = {
  // 品牌名（owner 2026-08-19 定名）：中文按 owner 原文；日文暂用英文品牌名，
  // 待 owner 给出日文名再替换（不自行创译品牌）。
  appTitle: {
    zh: '3DQiFlow',
    en: '3DQiFlow',
    ja: '3DQiFlow'
  },
  appSubtitle: {
    zh: '3D INTERACTIVE · 中气如轴 · 四维如轮',
    en: '3D INTERACTIVE · The center qi as axle, the four aspects as wheel',
    ja: '3D INTERACTIVE · 中気は軸、四維は輪'
  },
  sceneAxis: { zh: '轴轮模型', en: 'Axle & Wheel', ja: '軸輪モデル' },
  sceneAcupoint: { zh: '经穴图', en: 'Qi Flow', ja: '経穴図' },
  sceneMeridian: { zh: '十二经运行', en: 'Alternation', ja: '十二経運行' },
  sceneFormula: { zh: '方剂详解', en: 'Formulas', ja: '方剤詳解' },
  sceneSolar: { zh: '节气剧场', en: 'Solar Terms', ja: '節気シアター' },
  sceneHetu: { zh: '河图洛书', en: 'Hetu & Luoshu', ja: '河図洛書' },
  scenePulse: { zh: '脉舌3D', en: 'Pulse & Tongue', ja: '脈舌3D' },
  sceneReader: { zh: '条文阅读', en: 'Article Reader', ja: '条文リーダー' },
  sceneScreensaver: { zh: '天人', en: 'Cosmic', ja: '天人' },
  sceneAbout: { zh: '声明', en: 'Notices', ja: '声明' },
  settings: { zh: '设置', en: 'Settings', ja: '設定' },
  language: { zh: '语言 / Language', en: 'Language', ja: '言語' },
  theme: { zh: '主题', en: 'Theme', ja: 'テーマ' },
  themeDark: { zh: '暗色', en: 'Dark', ja: 'ダーク' },
  themeLight: { zh: '亮色', en: 'Light', ja: 'ライト' },
  themeSystem: { zh: '跟随系统', en: 'System', ja: 'システム' },
  replayOnboarding: { zh: '🎬 重看引导', en: '🎬 Replay intro', ja: '🎬 ガイドを再生' },
  resetProgress: { zh: '重置学习进度', en: 'Reset learning progress', ja: '学習進捗をリセット' },
  resetDone: { zh: '已重置', en: 'Reset done', ja: 'リセット済み' },
  close: { zh: '关闭', en: 'Close', ja: '閉じる' },
  contentNote: {
    zh: '界面已多语言化；条文/方剂/语录等经典内容暂为中文（不做机器翻译，待真实译本）。',
    en: 'The interface is multilingual; classical content (articles, formulas, quotes) remains in Chinese until authentic translations are sourced — no machine-invented translations.',
    ja: 'UIは多言語対応済み。条文・方剤・語録などの古典内容は、真正な訳が用意されるまで中国語のままです（機械翻訳による捏造はしません）。'
  },
  onboardNext: { zh: '下一步 →', en: 'Next →', ja: '次へ →' },
  onboardPrev: { zh: '← 上一步', en: '← Back', ja: '← 戻る' },
  onboardSkip: { zh: '跳过', en: 'Skip', ja: 'スキップ' },
  onboardStart: { zh: '开始学习 ✓', en: 'Start learning ✓', ja: '学習を始める ✓' }
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang];
}

/* ------------------------------------------------------------------ *
 * 全局语言开关（owner 2026-09-03：Show HN 前补齐英文界面）
 *
 * 组件不再逐层传 lang：App 以 useLang() 订阅并用 key={lang} 整树重挂，
 * 各组件用 tr('中文原文') 就地取译。词典按中文原串为键（i18nDict.ts），
 * 缺词回退中文——UI 骨架全量收录；经典内容不机器翻译（见文件头范围界定）。
 * ------------------------------------------------------------------ */
import { useSyncExternalStore } from 'react';
import { EN } from './i18nDict';

// 惰性求值：KEY_LANG 在本文件更靠后（const 有暂时性死区），模块顶层直接
// loadLang() 会被其 try/catch 吞成 'zh'——首次访问时再读取存储。
let current: Lang | null = null;
/** 把语言写到 <html data-lang>：英文比中文长，侧栏宽度由 CSS 据此放宽 */
function applyLangAttr(lang: Lang): void {
  try { document.documentElement.dataset.lang = lang; } catch { /* SSR / 无 DOM */ }
}
const lang0 = (): Lang => {
  if (current === null) { current = loadLang(); applyLangAttr(current); }
  return current;
};
const subscribers = new Set<() => void>();

export function getLang(): Lang {
  return lang0();
}
export function setLang(lang: Lang): void {
  current = lang;
  saveLang(lang);
  applyLangAttr(lang);
  subscribers.forEach((fn) => fn());
}
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { subscribers.add(cb); return () => subscribers.delete(cb); },
    () => lang0()
  );
}
/** 界面串就地取译：zh 原样返回；en 查词典，缺词回退中文（决不虚构） */
export function tr(zh: string): string {
  return lang0() === 'zh' ? zh : (EN[zh] ?? zh);
}

const KEY_LANG = 'yy_lang';
const KEY_THEME = 'yy_theme';
export type ThemeMode = 'dark' | 'light' | 'system';

export function loadLang(): Lang {
  // owner 2026-09-03：英文为默认落地语言（Show HN 面向国际读者）；
  // 已明确选过中文/日文的用户仍按其存量偏好。
  try {
    const v = localStorage.getItem(KEY_LANG);
    return v === 'zh' || v === 'ja' ? v : 'en';
  } catch {
    return 'en';
  }
}
export function saveLang(lang: Lang): void {
  try { localStorage.setItem(KEY_LANG, lang); } catch { /* ignore */ }
}
export function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY_THEME);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}
export function saveThemeMode(mode: ThemeMode): void {
  try { localStorage.setItem(KEY_THEME, mode); } catch { /* ignore */ }
}
export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
