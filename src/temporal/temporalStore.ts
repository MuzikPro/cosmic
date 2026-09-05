/**
 * 时辰经络运行态的唯一持有者。开启时每秒（预览态每 200 ms）从时间来源重算一次；
 * 关闭时不计时、不占资源，快照为 null——无时间维度的原有演示不依赖本模块。
 *
 * 页面隐藏/聚焦/定时器断层（合盖休眠）后一律从"现在"重算并平滑接入，
 * 绝不把错过的时辰快放追赶（spec §46–47）。
 */
import { useSyncExternalStore } from 'react';
import { resolveTemporal } from './shichen';
import { createVirtualClock, VirtualClock } from './timeSource';
import type { TemporalMeridianState, TemporalSoundscapeSettings } from './types';

type Snapshot = TemporalMeridianState | null;
type Listener = () => void;

export type StoreConfig = Pick<TemporalSoundscapeSettings,
  'enabled' | 'timeSource' | 'manualIndex' | 'previewCycleMinutes' | 'transitionMinutes'> & { debugOffsetSeconds?: number };

const configKey = (c: StoreConfig) =>
  `${c.enabled}|${c.timeSource}|${c.manualIndex}|${c.previewCycleMinutes}|${c.transitionMinutes}|${c.debugOffsetSeconds ?? 0}`;

class TemporalStore {
  private listeners = new Set<Listener>();
  private snap: Snapshot = null;
  private clock: VirtualClock | null = null;
  private cfg: StoreConfig | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getSnapshot = (): Snapshot => this.snap;
  isRunning = (): boolean => this.timer !== null;

  /** 幂等：同样的配置不重启时钟（预览锚点不被重置） */
  configure(cfg: StoreConfig): void {
    if (this.cfg && configKey(this.cfg) === configKey(cfg)) return;
    this.cfg = { ...cfg };
    this.stop();
    if (!cfg.enabled) { this.setSnap(null); return; }
    this.clock = createVirtualClock({
      source: cfg.timeSource, manualIndex: cfg.manualIndex, previewCycleMinutes: cfg.previewCycleMinutes,
      debugOffsetSeconds: cfg.debugOffsetSeconds
    });
    this.tick();
    const period = cfg.timeSource === 'PREVIEW_24H_CYCLE' ? 200 : 1000;
    this.timer = setInterval(this.tick, period);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onWake);
      window.addEventListener('focus', this.onWake);
    }
  }

  /** 立即重算（外部唤醒钩子也可调用） */
  tick = (): void => {
    if (!this.clock || !this.cfg) return;
    const now = this.clock.now();
    const r = resolveTemporal(now, this.cfg.transitionMinutes);
    this.lastTick = Date.now();
    this.setSnap({
      ...r, now,
      source: this.cfg.timeSource,
      manual: this.cfg.timeSource === 'MANUAL_SHICHEN',
      preview: this.cfg.timeSource === 'PREVIEW_24H_CYCLE'
    });
  };

  private onWake = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    this.tick();   // 旧态作废，按真实"现在"重算；订阅方各自平滑接入
  };

  /** 上次重算距今的秒数（音频层判断是否需要"平滑接入"而非渐进） */
  secondsSinceTick(): number { return this.lastTick ? (Date.now() - this.lastTick) / 1000 : Infinity; }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onWake);
      window.removeEventListener('focus', this.onWake);
    }
    this.clock = null;
  }

  /** 测试用：完全复位 */
  reset(): void { this.stop(); this.cfg = null; this.setSnap(null); }

  private setSnap(s: Snapshot): void {
    this.snap = s;
    this.listeners.forEach((l) => l());
  }
}

export const temporalStore = new TemporalStore();

/** React 订阅：关闭时恒为 null，组件据此走原有无时间维度的路径 */
export function useTemporalState(): Snapshot {
  return useSyncExternalStore(temporalStore.subscribe, temporalStore.getSnapshot, () => null);
}
