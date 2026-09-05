import { CSSProperties } from 'react';
import { UI, BACKGROUND } from '@/styles/theme';

/**
 * 悬浮玻璃面板的公共样式（图例/滑块/信息卡/剧场控制面板共用）。
 * 用 getter 而非固化值：主题切换会就地替换 UI 令牌，
 * spread（{...panelStyle}）时才取值，保证明暗主题实时生效。
 */
export const panelStyle: CSSProperties = {
  get background() {
    return UI.panelBg;
  },
  backdropFilter: 'blur(10px)',
  get border() {
    return `1px solid ${UI.panelBorder}`;
  }
} as CSSProperties;

/** 小型切换按钮 */
export function toggleButtonStyle(active: boolean): CSSProperties {
  return {
    background: active ? UI.accent : 'transparent',
    color: active ? BACKGROUND.primary : UI.textSecondary,
    border: `1px solid ${active ? UI.accent : UI.panelBorder}`,
    borderRadius: '14px',
    padding: '4px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  };
}
