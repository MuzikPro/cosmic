import { useSyncExternalStore } from 'react';
import { UI, RADIUS } from '@/styles/theme';
import { panelStyle, toggleButtonStyle } from '../UI/panelStyle';
import { useTemporalState } from '@/temporal/temporalStore';
import { SLOT_SECONDS, secondsOfDay, slotStartSeconds } from '@/temporal/shichen';
import type { TemporalSoundscapeSettings } from '@/temporal/types';
import { liveAudio } from '@/audio/audioEngine';
import { describeModulation, vesselWeightsFromVisible } from '@pack';

/**
 * 开发/调试面板（spec §48–49）：只在 ?debug 或开发构建下出现，不进普通屏保界面。
 * 英文即可（工具面板，不走词典）。跳边界靠 LOCAL 模式上的临时偏移，不持久化。
 */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function TemporalDebugPanel({ t, setT, offset, setOffset, visible }: {
  t: TemporalSoundscapeSettings; setT: (p: Partial<TemporalSoundscapeSettings>) => void;
  offset: number; setOffset: (s: number) => void; visible: string[];
}) {
  const st = useTemporalState();
  const audio = useSyncExternalStore(liveAudio.subscribe, () => liveAudio.state, () => 'idle' as const);
  const b = (label: string, onClick: () => void, on = false) => (
    <button key={label} style={{ ...toggleButtonStyle(on), fontSize: '10px', padding: '2px 6px' }} onClick={onClick}>{label}</button>
  );
  /** 让"现在"落到当前时辰边界 + delta 秒（LOCAL 模式） */
  const jump = (delta: number) => {
    const real = new Date();
    const sod = secondsOfDay(real);
    const idx = Math.floor((((sod / 3600) + 1) % 24) / 2);
    const start = slotStartSeconds(idx);
    const elapsed = ((sod - start) % 86400 + 86400) % 86400;
    const toBoundary = SLOT_SECONDS - elapsed;
    setT({ timeSource: 'LOCAL_REAL_TIME' });
    setOffset(toBoundary + delta);
  };
  const step = (d: number) => {
    const idx = st ? st.index : 0;
    setT({ timeSource: 'MANUAL_SHICHEN', manualIndex: (idx + d + 12) % 12 });
  };
  const vw = vesselWeightsFromVisible(visible, t.vesselModulation);
  const modText = st ? describeModulation(visible, t.vesselModulation, t.spatialMode, st.entry.polarity) : null;
  const row = (k: string, v: string) => (
    <div key={k} style={{ display: 'flex', gap: '8px' }}><span style={{ color: UI.textMuted, minWidth: '92px' }}>{k}</span><span>{v}</span></div>
  );
  return (
    <div style={{ ...panelStyle, position: 'fixed', left: '18px', top: '52px', zIndex: 131, width: '300px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
                  borderRadius: RADIUS.md, padding: '10px 12px', fontSize: '10px', fontFamily: 'ui-monospace, Menlo, monospace', lineHeight: 1.6, color: UI.textSecondary }}>
      <div style={{ color: UI.accent, letterSpacing: '2px', marginBottom: '4px' }}>TEMPORAL DEBUG</div>
      {row('enabled', String(t.enabled))}
      {row('source', t.timeSource + (offset ? ` (offset ${offset >= 0 ? '+' : ''}${Math.round(offset)} s)` : ''))}
      {row('real local', fmt(new Date()))}
      {st ? (
        <>
          {row('virtual now', fmt(st.now))}
          {row('shichen', `${st.entry.shichen} ${st.entry.pinyin} (${st.index})  ${st.entry.hours}`)}
          {row('active', `${st.entry.code} · ${st.entry.element} · ${st.entry.tone} · ${st.entry.polarity}${st.entry.ministerFire ? ' · 相火' : ''}`)}
          {row('prev / next', `${st.previous.code} / ${st.next.code}`)}
          {row('progress', `${(st.slotProgress * 100).toFixed(2)} %  (${Math.round(st.elapsedSeconds)} s)`)}
          {row('weights', `p ${st.previousWeight.toFixed(3)}  a ${st.activeWeight.toFixed(3)}  n ${st.nextWeight.toFixed(3)}  ${st.transition ?? 'stable'}`)}
        </>
      ) : row('state', 'null (temporal off)')}
      {row('audio', `${audio} · vol ${t.masterVolume.toFixed(2)} · density ${t.musicDensity.toFixed(2)} · center ${t.tonalCenterMidi} · oct ${t.octaveBias}`)}
      {row('preview', `${t.previewCycleMinutes} min / day · transition ${t.transitionMinutes} min`)}
      {row('vessels', Object.entries(vw).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' '))}
      {modText && row('modulation', modText)}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
        {b('◀ shichen', () => step(-1))}{b('shichen ▶', () => step(1))}
        {b('boundary −10m', () => jump(-600))}{b('−1m', () => jump(-60))}{b('boundary', () => jump(0))}{b('+1m', () => jump(60))}
        {b('24h in 2 min', () => setT({ timeSource: 'PREVIEW_24H_CYCLE', previewCycleMinutes: 2 }), t.timeSource === 'PREVIEW_24H_CYCLE')}
        {b('real time', () => { setOffset(0); setT({ timeSource: 'LOCAL_REAL_TIME' }); }, t.timeSource === 'LOCAL_REAL_TIME' && !offset)}
      </div>
    </div>
  );
}
