import { UI } from '@/styles/theme';
import { tr, useLang } from '@/i18n';
import { FIVE_TONES } from '@/data/meridianClock';
import { useTemporalState } from '@/temporal/temporalStore';
import type { OverlayMode } from '@/temporal/types';

/**
 * 时辰信息叠层（owner 2026-09-05）：左下角、极淡，与现有角标同一气质。
 * 进入/交互后清晰几秒（跟随界面显隐），随后退到很低的不透明度；可完全关闭。
 * 自己订阅时辰状态（每秒一变），父组件不因它重渲。
 */
const ELEMENT_ZH: Record<string, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
const pad = (n: number) => String(n).padStart(2, '0');

export function TemporalOverlay({ mode, bright }: { mode: OverlayMode; bright: boolean }) {
  const lang = useLang();
  const state = useTemporalState();
  if (!state || mode === 'OFF') return null;
  const e = state.entry;
  const tone = FIVE_TONES[e.tone];
  const hhmm = `${pad(state.now.getHours())}:${pad(state.now.getMinutes())}`;
  const meridianName = lang === 'zh' ? e.meridianFull : `${tr(e.organ)} meridian`;
  const badge = state.manual ? tr('手动时辰 · 不跟随当前时间') : state.preview ? tr('24 小时预览 · 压缩的一天') : null;
  const line: React.CSSProperties = { whiteSpace: 'nowrap' };
  return (
    <div aria-live="off" style={{
      position: 'fixed', left: '18px', bottom: '16px', zIndex: 124, pointerEvents: 'none',
      color: UI.textSecondary, fontSize: '11px', letterSpacing: '1px', lineHeight: 1.75,
      textShadow: '0 1px 6px rgba(0,0,0,0.7)',
      opacity: bright ? 0.85 : 0.18, transition: 'opacity 1.4s ease'
    }}>
      {badge && <div style={{ ...line, fontSize: '9px', color: UI.accent, letterSpacing: '1.5px', marginBottom: '2px' }}>{badge}</div>}
      <div style={{ ...line, fontSize: '15px', letterSpacing: '2px', color: UI.textPrimary }}>{hhmm}</div>
      <div style={line}>{e.shichen} · {e.pinyin}</div>
      <div style={line}>{meridianName}</div>
      <div style={line}>{tone.zh} · {tone.pinyin} · {tr(ELEMENT_ZH[e.element])}</div>
      {mode === 'DETAILED' && (
        <div style={{ marginTop: '4px', fontSize: '10px', color: UI.textMuted }}>
          <div style={line}>{tr('区间')} {e.hours} · {tr('进度')} {Math.round(state.slotProgress * 100)}%</div>
          <div style={line}>{tr('下一')} {state.next.shichen} · {lang === 'zh' ? state.next.meridianFull : `${tr(state.next.organ)} meridian`} · {FIVE_TONES[state.next.tone].zh}</div>
          {state.transition && <div style={line}>{tr('过渡中')} {Math.round(state.activeWeight * 100)}%</div>}
        </div>
      )}
    </div>
  );
}
