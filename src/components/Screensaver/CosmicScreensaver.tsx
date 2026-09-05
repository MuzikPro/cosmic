import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BACKGROUND, THREE_DEFAULTS, UI, RADIUS } from '@/styles/theme';
import { panelStyle, toggleButtonStyle } from '../UI/panelStyle';
import { Starfield } from '../AxisWheel/Starfield';
import { BodyMesh } from '../MeridianTheater/BodyMesh';
import { BodyFigure } from '../MeridianTheater/BodyFigure';
import { MeridianLine, QiFlow } from '../three/MeridianSystem';
import { TWELVE, VESSELS_EIGHT, VESSEL_SIX, HAND_SIX, FOOT_SIX, YIN_SIX, YANG_SIX, NO_MIRROR, meridianColor, VESSEL_META } from '../Acupoints/pointGeometry';
import { MERIDIAN_META } from '@/data/acupoints';
import { tr, useLang, setLang } from '@/i18n';
import {
  ScreensaverSettings, DEFAULT_SETTINGS, ALL_MERIDIANS, loadSettings, saveSettings,
  OrbitStyle, AxisMode, RotationRange, ViewMode
} from './screensaverSettings';
import { MERIDIAN_CLOCK, FIVE_TONES } from '@/data/meridianClock';
import { temporalStore, useTemporalState } from '@/temporal/temporalStore';
import { meridianWeights, emphasisScale } from '@/temporal/shichen';
import type { TemporalMeridianState, TemporalSoundscapeSettings, TimeSource, OverlayMode } from '@/temporal/types';
import { TemporalOverlay } from './TemporalOverlay';
import { liveAudio, LiveAudio, MASTER_MAX } from '@/audio/audioEngine';
import { soundscapeController } from '@/audio/controller';

/**
 * 宇宙经络 · 屏保（owner 2026-09-05）——一具透明人体悬在星空中央，十二正经与
 * 奇经八脉同时极慢地行气；观者或绕体缓飞（镜头环绕），或人体自缓缓自转。
 *
 * 复用而非再造：星空＝轴轮/河图同一 Starfield；人体＝经穴图同一 NIH 男体（atlas
 * 材质）；经线与气流＝经穴图抽出的共用件；经络几何＝同一注册表（任督只此一份）。
 * 人体与全部经络挂在同一 rig 组下，缩放/转动一起动，解剖关系永不错位。
 * 单一驱动件（Driver）持有全部逐帧逻辑；临时向量预分配，不在帧内 new。
 */

const BODY_CENTER = new THREE.Vector3(0, 0.15, 0);
const BASE_RADIUS = 9.5;     // 经穴图默认机位距离
const SAFE_RADIUS = 5.2;     // 人体（含手足）外接半径的安全裕量，× 体量
/** 人体轮廓（臂微张）宽高比约 0.75；视口比它更窄（竖屏手机 ≈0.46）时按宽度定机位，
 *  否则肩臂被裁到屏外，只剩躯干（owner 2026-09-05 实录：375×812 首屏）。0.85 留一点边。 */
const BODY_ASPECT = 0.85;
const TWO_PI = Math.PI * 2;
const D2R = Math.PI / 180;
/** App 换语言时整树重挂（App.tsx key={lang}）；面板开合跨重挂保留，切语言不丢面板 */
let panelOpenAcrossRemount = false;
/** 互链：主站内的屏保页指向独立站；独立站左上角指回主站 */
const COSMIC_SITE = 'https://cosmic.3dqiflow.com/';
const MAIN_SITE = 'https://www.3dqiflow.com/';
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** 逐帧驱动：镜头环绕 / 人体自转、手动交互后的柔和接回、视场角 */
function Driver({ settingsRef, rigRef, manualRef, controlsRef }: {
  settingsRef: React.MutableRefObject<ScreensaverSettings>;
  rigRef: React.RefObject<THREE.Group>;
  manualRef: React.MutableRefObject<{ active: boolean; endedAt: number; resume: number }>;
  controlsRef: React.RefObject<{ target: THREE.Vector3; enabled: boolean; update: () => void }>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const t = useRef(0);
  const theta = useRef(0);     // 环绕累计方位角（速度变化不跳）
  const spin = useRef(0);      // 自转累计角
  const sph = useMemo(() => new THREE.Spherical(), []);
  const want = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const resumeFrom = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    t.current += dt;
    const s = settingsRef.current;
    const m = manualRef.current;

    if (camera.fov !== s.camera.fov) { camera.fov = s.camera.fov; camera.updateProjectionMatrix(); }

    // ── 镜头目标位（两种模式都算：自转模式镜头驻正前方） ──
    // 竖屏按宽度退远：水平视场 = 垂直视场 × 宽高比，比例越窄需要的距离越远
    const portraitFit = Math.max(1, BODY_ASPECT / Math.max(0.2, size.width / Math.max(1, size.height)));
    const radius = Math.max(BASE_RADIUS * s.camera.distance, SAFE_RADIUS * s.bodyScale) * portraitFit;
    let elev = s.camera.elevation;
    let thetaNow: number;
    if (s.mode !== 'bodyRotation') {
      const rate = s.camera.orbitSpeed * (TWO_PI / 40);      // 1.0x ＝ 40 秒一周；0.1x ＝ 400 秒
      theta.current += dt * rate;
      thetaNow = theta.current;
      const drift = Math.sin(t.current * 0.05);              // ~2 分钟一个起伏周期
      switch (s.camera.orbitStyle) {
        case 'horizontal': break;
        case 'elevated': elev = Math.min(75, elev + 25); break;
        case 'spherical': elev = elev + s.camera.inclination * drift; break;
        case 'free':
          elev = elev + s.camera.inclination * drift * 1.3;
          thetaNow += 0.35 * Math.sin(t.current * 0.031);
          break;
      }
    } else {
      thetaNow = 0;
    }
    elev = Math.max(-80, Math.min(80, elev));
    sph.set(s.mode === 'bodyRotation' ? Math.max(radius, SAFE_RADIUS * s.bodyScale) : radius,
            Math.PI / 2 - elev * D2R, thetaNow);
    want.setFromSpherical(sph).add(BODY_CENTER);

    // ── 手动交互：拖动中不接管；松手后 0.6 秒让惯性走完，再 3 秒缓接回 ──
    const now = state.clock.elapsedTime;
    if (!m.active) {
      const sinceEnd = now - m.endedAt;
      if (sinceEnd > 0.6) {
        if (m.resume < 1) {
          if (m.resume === 0) resumeFrom.copy(camera.position);
          m.resume = Math.min(1, m.resume + dt / 3);
          camera.position.lerpVectors(resumeFrom, want, easeInOut(m.resume));
        } else {
          camera.position.lerp(want, 1 - Math.exp(-dt * 2.5));   // 阻尼跟随：滑块改值不跳
        }
        camera.lookAt(BODY_CENTER);
        const c = controlsRef.current;
        if (c) { c.target.copy(BODY_CENTER); }
      }
    }

    // ── 人体 rig 朝向 ──
    const rig = rigRef.current;
    if (rig) {
      if (s.mode !== 'cameraOrbit') {
        const b = s.bodyRotation;
        const rate = b.speed * (TWO_PI / 40);
        spin.current += dt * rate;
        const sweep = b.range === 360 ? spin.current : (b.range / 2) * D2R * Math.sin(spin.current);
        let yaw = 0, pitch = 0, roll = 0;
        switch (b.axisMode) {
          case 'y': yaw = sweep; break;
          case 'x': pitch = sweep; break;
          case 'z': roll = sweep; break;
          case 'xyzDrift':
            yaw = sweep;
            pitch = 0.16 * Math.sin(t.current * 0.07);
            roll = 0.07 * Math.sin(t.current * 0.05 + 1.3);
            break;
          case 'custom':
            yaw = b.yaw * D2R + sweep;
            pitch = b.pitch * D2R;
            roll = b.roll * D2R;
            break;
        }
        euler.set(pitch, yaw, roll, 'YXZ');
        q.setFromEuler(euler);
      } else {
        q.identity();
      }
      rig.quaternion.slerp(q, 1 - Math.exp(-dt * 2.0));
      const sc = s.bodyScale;
      if (Math.abs(rig.scale.x - sc) > 1e-4) rig.scale.setScalar(sc);
    }
  });
  return null;
}

type EmphasisRefs = Map<string, { v: number }>;
/** 奇经不入钟面：时辰模式下按 0.3 权重轻微退后，保持"整个经络身体都在" */
const VESSEL_WEIGHT = 0.3;

/**
 * 时辰侧重驱动（Canvas 内）：订阅时辰状态（每秒一变），逐帧把每条经的目标系数
 * 阻尼逼近。关闭时目标恒为 1——线与光点回到原样，无时间维度的演示不受影响。
 */
function TemporalDriver({ refs, settingsRef }: {
  refs: EmphasisRefs; settingsRef: React.MutableRefObject<ScreensaverSettings>;
}) {
  const weights = useRef<Record<string, number> | null>(null);
  // 开发期可从控制台读到每条经的实时系数（生产构建中 import.meta.env.DEV 为 false，整段被消除）
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __cosmicEmphasis?: EmphasisRefs }).__cosmicEmphasis = refs;
  }, [refs]);
  useEffect(() => {
    const apply = () => {
      const st: TemporalMeridianState | null = temporalStore.getSnapshot();
      weights.current = st ? meridianWeights(st) : null;
    };
    apply();
    return temporalStore.subscribe(apply);
  }, []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const k = 1 - Math.exp(-dt * 1.5);
    const w = weights.current;
    const e = settingsRef.current.temporal.visualEmphasis;
    refs.forEach((ref, code) => {
      const target = w ? emphasisScale(w[code] ?? VESSEL_WEIGHT, e) : 1;
      ref.v += (target - ref.v) * k;
    });
  });
  return null;
}

/** 人体 + 全部经络：同一 rig 组（自转/缩放一起动） */
function BodyRig({ rigRef, opacity, flowRef, visible, emphasis }: {
  rigRef: React.RefObject<THREE.Group>; opacity: number; flowRef: { v: number }; visible: string[];
  emphasis: EmphasisRefs;
}) {
  return (
    <group ref={rigRef}>
      <Suspense fallback={<BodyFigure opacity={0.2} />}>
        <BodyMesh variant="atlas" sex="male" opacity={opacity} />
      </Suspense>
      {visible.map((code) => {
        const em = emphasis.get(code);
        return (
          <group key={code}>
            <MeridianLine code={code} mirrored={false} dim={false} sex="male" radiusScale={1.15} brightness={1.2} emphasisRef={em} />
            <QiFlow code={code} mirrored={false} speed={1} sex="male" size={0.06} speedRef={flowRef} emphasisRef={em} />
            {!NO_MIRROR.has(code) && (
              <>
                <MeridianLine code={code} mirrored dim={false} sex="male" radiusScale={1.15} brightness={1.2} emphasisRef={em} />
                <QiFlow code={code} mirrored speed={1} sex="male" size={0.06} speedRef={flowRef} emphasisRef={em} />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ───────────────── 设置面板 ───────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '10px', color: UI.textMuted, letterSpacing: '1px' }}>{label}</div>
      {children}
    </div>
  );
}
function Slider({ value, min, max, step, onChange, format }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(parseFloat(e.target.value))}
             style={{ flex: 1, accentColor: UI.accent }} />
      <span style={{ fontSize: '10px', color: UI.textSecondary, minWidth: '38px', textAlign: 'right' }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}
function Choice<T extends string | number>({ value, options, onChange }: {
  value: T; options: Array<[T, string]>; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {options.map(([v, label]) => (
        <button key={String(v)} style={{ ...toggleButtonStyle(value === v), fontSize: '10px', padding: '2px 8px' }}
                onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}
const H = ({ text }: { text: string }) => (
  <div style={{ fontSize: '10px', color: UI.accent, letterSpacing: '2px', marginTop: '6px' }}>{text}</div>
);

/** 经络选择：快捷集 + 逐条开关（chip 用该经本色，悬停显全名） */
const VESSEL_SHORT: Record<string, string> = { CHONG: '衝', DAI: '帶', YINQIAO: '陰蹻', YANGQIAO: '陽蹻', YINWEI: '陰維', YANGWEI: '陽維' };
const fullName = (code: string) =>
  MERIDIAN_META.find((m) => m.code === code)?.zh ?? VESSEL_META.find((v) => v.code === code)?.zh ?? code;
const shortName = (code: string) => (VESSEL_SHORT[code] ? tr(VESSEL_SHORT[code]) : code);

function MeridianPicker({ visible, onChange }: { visible: string[]; onChange: (v: string[]) => void }) {
  const has = new Set(visible);
  const sets: Array<[string, string[]]> = [
    [tr('全部'), ALL_MERIDIANS], [tr('十二正经'), TWELVE], [tr('奇经八脉'), VESSELS_EIGHT],
    [tr('手六经'), HAND_SIX], [tr('足六经'), FOOT_SIX], [tr('阴六经'), YIN_SIX], [tr('阳六经'), YANG_SIX]
  ];
  const same = (a: string[]) => a.length === visible.length && a.every((c) => has.has(c));
  const toggle = (code: string) =>
    onChange(has.has(code) ? visible.filter((c) => c !== code) : ALL_MERIDIANS.filter((c) => has.has(c) || c === code));
  const chip = (code: string) => {
    const on = has.has(code);
    const color = meridianColor(code);
    return (
      <button key={code} title={tr(fullName(code))} onClick={() => toggle(code)}
              style={{ ...toggleButtonStyle(on), fontSize: '10px', padding: '2px 7px',
                       borderColor: on ? color : undefined, color: on ? color : undefined,
                       background: on ? `${color}22` : undefined }}>
        {shortName(code)}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {sets.map(([label, codes]) => (
          <button key={label} style={{ ...toggleButtonStyle(same(codes)), fontSize: '10px', padding: '2px 8px' }}
                  onClick={() => onChange(codes)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{TWELVE.map(chip)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{['CV', 'GV', ...VESSEL_SIX].map(chip)}</div>
    </div>
  );
}

/** 面板里的一行"此刻"：自己订阅时辰状态，父面板不因每秒一变而重渲 */
function TemporalNowLine() {
  const st = useTemporalState();
  if (!st) return null;
  const e = st.entry;
  return (
    <div style={{ fontSize: '10px', color: UI.textSecondary, letterSpacing: '1px' }}>
      {tr('此刻')} · {e.shichen} {e.pinyin} · {tr(e.organ)} · {FIVE_TONES[e.tone].zh} {FIVE_TONES[e.tone].pinyin}
      {st.transition ? ` · ${tr('过渡中')}` : ''}
    </div>
  );
}

/**
 * 时间与声音（时辰经络音景）设置：一个总开关之后才展开；关闭时不产生任何时间维度逻辑。
 * 第一波：时间来源 / 过渡 / 叠层 / 视觉侧重；音量与密度随音频层（第四阶段）一起出现。
 */
/** 上一次非零音量（静音切回用） */
let lastAudibleVolume = 0.2;

function useLiveAudioState() {
  return useSyncExternalStore(liveAudio.subscribe, () => liveAudio.state, () => 'idle' as const);
}

function TimeAndSoundSection({ t, setT }: { t: TemporalSoundscapeSettings; setT: (patch: Partial<TemporalSoundscapeSettings>) => void }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const [advanced, setAdvanced] = useState(false);
  const audioState = useLiveAudioState();
  const supported = LiveAudio.supported();
  // 总开关的点击就是浏览器要求的用户手势：在这里创建/恢复 AudioContext
  const toggle = () => {
    const next = !t.enabled;
    setT({ enabled: next });
    if (next && supported) void liveAudio.start(t.masterVolume);
    else if (!next) void liveAudio.stop();
  };
  const mute = () => {
    if (t.masterVolume > 0) { lastAudibleVolume = t.masterVolume; setT({ masterVolume: 0 }); }
    else setT({ masterVolume: lastAudibleVolume || 0.2 });
  };
  return (
    <>
      <button style={{ ...toggleButtonStyle(t.enabled), fontSize: '10px', padding: '3px 8px', textAlign: 'left' }}
              onClick={toggle}>
        {tr('时辰经络音景')}{t.enabled ? ' · ON' : ' · OFF'}
      </button>
      {t.enabled && (
        <>
          <Row label={tr('声音')}>
            {!supported && <div style={{ fontSize: '9px', color: UI.textMuted }}>{tr('此浏览器不支持 Web Audio')}</div>}
            {supported && audioState !== 'running' && (
              <button style={{ ...toggleButtonStyle(false), fontSize: '10px', padding: '2px 8px', borderColor: UI.accent, color: UI.accent }}
                      onClick={() => void liveAudio.start(t.masterVolume)}>
                ♪ {tr('开始声音')}
              </button>
            )}
            <Slider value={t.masterVolume} min={0} max={MASTER_MAX} step={0.01} format={(v) => pct(v / MASTER_MAX)}
              onChange={(v) => setT({ masterVolume: v })} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ ...toggleButtonStyle(t.masterVolume === 0), fontSize: '10px', padding: '2px 8px' }} onClick={mute}>
                {t.masterVolume === 0 ? tr('取消静音') : tr('静音')}
              </button>
              <button style={{ ...toggleButtonStyle(advanced), fontSize: '10px', padding: '2px 8px' }} onClick={() => setAdvanced((v) => !v)}>
                {tr('高级')}
              </button>
            </div>
          </Row>
          <Row label={tr('密度')}>
            <Slider value={t.musicDensity} min={0} max={1} step={0.05} format={pct} onChange={(v) => setT({ musicDensity: v })} />
          </Row>
          {advanced && (
            <>
              <Row label={tr('调中心（参考值）')}>
                <Slider value={t.tonalCenterMidi} min={38} max={62} step={1} format={(v) => `${v}`} onChange={(v) => setT({ tonalCenterMidi: v })} />
              </Row>
              <Row label={tr('八度偏移')}>
                <Slider value={t.octaveBias} min={-1} max={1} step={1} format={(v) => `${v > 0 ? '+' : ''}${v}`} onChange={(v) => setT({ octaveBias: v })} />
              </Row>
              <div style={{ fontSize: '9px', color: UI.textMuted, lineHeight: 1.6 }}>{tr('五音是相对的调式功能，整个音景可整体移调；参考值不代表史实音高。')}</div>
            </>
          )}
          <Row label={tr('时间来源')}>
            <Choice<TimeSource> value={t.timeSource} onChange={(v) => setT({ timeSource: v })}
              options={[['LOCAL_REAL_TIME', tr('本地时间')], ['MANUAL_SHICHEN', tr('手动时辰')], ['PREVIEW_24H_CYCLE', tr('24 小时预览')]]} />
          </Row>
          {t.timeSource === 'MANUAL_SHICHEN' && (
            <Row label={tr('手动时辰')}>
              <Choice<number> value={t.manualIndex} onChange={(v) => setT({ manualIndex: v })}
                options={MERIDIAN_CLOCK.map((e, i) => [i, `${e.shichen} ${e.hours}`] as [number, string])} />
            </Row>
          )}
          {t.timeSource === 'PREVIEW_24H_CYCLE' && (
            <Row label={tr('预览时长')}>
              <Slider value={t.previewCycleMinutes} min={1} max={60} step={1} format={(v) => `${v} ${tr('分钟')}`}
                onChange={(v) => setT({ previewCycleMinutes: v })} />
            </Row>
          )}
          <Row label={tr('过渡时长')}>
            <Choice<5 | 10 | 15 | 20> value={t.transitionMinutes} onChange={(v) => setT({ transitionMinutes: v })}
              options={[[5, `5 ${tr('分钟')}`], [10, `10 ${tr('分钟')}`], [15, `15 ${tr('分钟')}`], [20, `20 ${tr('分钟')}`]]} />
          </Row>
          <Row label={tr('信息叠层')}>
            <Choice<OverlayMode> value={t.overlay} onChange={(v) => setT({ overlay: v })}
              options={[['OFF', tr('隐藏')], ['MINIMAL', tr('简')], ['DETAILED', tr('详')]]} />
          </Row>
          <Row label={tr('视觉侧重')}>
            <Slider value={t.visualEmphasis} min={0} max={1} step={0.05} format={pct} onChange={(v) => setT({ visualEmphasis: v })} />
          </Row>
          <TemporalNowLine />
          <div style={{ fontSize: '9px', color: UI.textMuted, lineHeight: 1.6 }}>
            {tr('十二时辰配十二经为教学钟面，非完整子午流注；仅供观赏与学习。')}
          </div>
        </>
      )}
    </>
  );
}

function SettingsPanel({ s, set, fullscreen, onFullscreen, onReset, lang, standaloneLink }: {
  lang: 'en' | 'zh';
  standaloneLink: boolean;
  s: ScreensaverSettings; set: (patch: (d: ScreensaverSettings) => ScreensaverSettings) => void;
  fullscreen: boolean; onFullscreen: () => void; onReset: () => void;
}) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const deg = (v: number) => `${Math.round(v)}°`;
  const speedTiers: Array<[number, string]> = [[0.05, tr('极慢')], [0.1, tr('慢')], [0.2, tr('正常')]];
  return (
    <div style={{
      ...panelStyle, position: 'fixed', right: '18px', bottom: '58px', zIndex: 130, width: '286px',
      maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', borderRadius: RADIUS.md, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '11px'
    }}>
      <div style={{ fontSize: '11px', color: UI.textMuted, letterSpacing: '2px' }}>{tr('宇宙经络 · 屏保设置')}</div>

      <H text={tr('视角模式')} />
      <Choice<ViewMode> value={s.mode} onChange={(v) => set((d) => ({ ...d, mode: v }))}
              options={[['cameraOrbit', tr('镜头环绕')], ['bodyRotation', tr('人体自转')], ['combined', tr('环绕 + 自转')]]} />

      <H text={tr('人体')} />
      <Row label={tr('体量')}><Slider value={s.bodyScale} min={0.6} max={1.6} step={0.02} format={pct}
        onChange={(v) => set((d) => ({ ...d, bodyScale: v }))} /></Row>
      <Row label={tr('透明度')}><Slider value={s.bodyOpacity} min={0.05} max={0.6} step={0.01} format={(v) => v.toFixed(2)}
        onChange={(v) => set((d) => ({ ...d, bodyOpacity: v }))} /></Row>

      <H text={tr('经络气行')} />
      <Row label={tr('气行速度')}>
        <Choice<number> value={s.flowSpeed} options={speedTiers} onChange={(v) => set((d) => ({ ...d, flowSpeed: v }))} />
        <Slider value={s.flowSpeed} min={0.05} max={1} step={0.01} format={(v) => `${v.toFixed(2)}x`}
          onChange={(v) => set((d) => ({ ...d, flowSpeed: v }))} />
      </Row>
      <Row label={tr('显示经络')}>
        <MeridianPicker visible={s.visible} onChange={(v) => set((d) => ({ ...d, visible: v }))} />
      </Row>

      {s.mode !== 'bodyRotation' && (
        <>
          <H text={tr('镜头环绕')} />
          <Row label={tr('环绕速度')}><Slider value={s.camera.orbitSpeed} min={0.02} max={1} step={0.01} format={(v) => `${v.toFixed(2)}x`}
            onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, orbitSpeed: v } }))} /></Row>
          <Row label={tr('镜头距离')}><Slider value={s.camera.distance} min={0.6} max={2} step={0.02} format={pct}
            onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, distance: v } }))} /></Row>
          <Row label={tr('仰角')}><Slider value={s.camera.elevation} min={-45} max={75} step={1} format={deg}
            onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, elevation: v } }))} /></Row>
          <Row label={tr('起伏幅度')}><Slider value={s.camera.inclination} min={0} max={90} step={1} format={deg}
            onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, inclination: v } }))} /></Row>
          <Row label={tr('环绕方式')}>
            <Choice<OrbitStyle> value={s.camera.orbitStyle} onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, orbitStyle: v } }))}
              options={[['horizontal', tr('水平')], ['elevated', tr('俯瞰')], ['spherical', tr('球面漂移')], ['free', tr('自由球面')]]} />
          </Row>
        </>
      )}
      {s.mode !== 'cameraOrbit' && (
        <>
          <H text={tr('人体自转')} />
          <Row label={tr('自转速度')}><Slider value={s.bodyRotation.speed} min={0.02} max={1} step={0.01} format={(v) => `${v.toFixed(2)}x`}
            onChange={(v) => set((d) => ({ ...d, bodyRotation: { ...d.bodyRotation, speed: v } }))} /></Row>
          <Row label={tr('转轴')}>
            <Choice<AxisMode> value={s.bodyRotation.axisMode} onChange={(v) => set((d) => ({ ...d, bodyRotation: { ...d.bodyRotation, axisMode: v } }))}
              options={[['y', 'Y'], ['x', 'X'], ['z', 'Z'], ['xyzDrift', tr('三轴漂移')], ['custom', tr('自定义')]]} />
          </Row>
          <Row label={tr('转动范围')}>
            <Choice<RotationRange> value={s.bodyRotation.range} onChange={(v) => set((d) => ({ ...d, bodyRotation: { ...d.bodyRotation, range: v } }))}
              options={[[360, tr('全周')], [180, '±180°'], [90, '±90°'], [45, '±45°']]} />
          </Row>
          {s.bodyRotation.axisMode === 'custom' && (
            <>
              <Row label={tr('偏航')}><Slider value={s.bodyRotation.yaw} min={-180} max={180} step={1} format={deg}
                onChange={(v) => set((d) => ({ ...d, bodyRotation: { ...d.bodyRotation, yaw: v } }))} /></Row>
              <Row label={tr('俯仰')}><Slider value={s.bodyRotation.pitch} min={-90} max={90} step={1} format={deg}
                onChange={(v) => set((d) => ({ ...d, bodyRotation: { ...d.bodyRotation, pitch: v } }))} /></Row>
              <Row label={tr('侧倾')}><Slider value={s.bodyRotation.roll} min={-90} max={90} step={1} format={deg}
                onChange={(v) => set((d) => ({ ...d, bodyRotation: { ...d.bodyRotation, roll: v } }))} /></Row>
            </>
          )}
          {s.mode === 'bodyRotation' && (
            <>
              <Row label={tr('镜头距离')}><Slider value={s.camera.distance} min={0.6} max={2} step={0.02} format={pct}
                onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, distance: v } }))} /></Row>
              <Row label={tr('仰角')}><Slider value={s.camera.elevation} min={-45} max={75} step={1} format={deg}
                onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, elevation: v } }))} /></Row>
            </>
          )}
        </>
      )}

      <H text={tr('时间与声音')} />
      <TimeAndSoundSection t={s.temporal} setT={(patch) => set((d) => ({ ...d, temporal: { ...d.temporal, ...patch } }))} />

      <H text={tr('显示')} />
      <Row label={tr('语言')}>
        <Choice<'en' | 'zh'> value={lang} onChange={(v) => setLang(v)} options={[['en', 'English'], ['zh', '中文']]} />
      </Row>
      <Row label={tr('视场角')}><Slider value={s.camera.fov} min={25} max={70} step={1} format={deg}
        onChange={(v) => set((d) => ({ ...d, camera: { ...d.camera, fov: v } }))} /></Row>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button style={{ ...toggleButtonStyle(fullscreen), fontSize: '10px', padding: '2px 8px' }} onClick={onFullscreen}>
          {fullscreen ? tr('退出全屏') : tr('全屏')}
        </button>
        <button style={{ ...toggleButtonStyle(s.manualInteraction), fontSize: '10px', padding: '2px 8px' }}
                onClick={() => set((d) => ({ ...d, manualInteraction: !d.manualInteraction }))}>
          {tr('手动交互')}{s.manualInteraction ? ' · ON' : ' · OFF'}
        </button>
      </div>
      <button style={{ ...toggleButtonStyle(false), fontSize: '10px', padding: '3px 8px', marginTop: '4px' }} onClick={onReset}>
        {tr('恢复默认')}
      </button>
      {standaloneLink && (
        <a href={COSMIC_SITE} target="_blank" rel="noopener"
           style={{ fontSize: '10px', color: UI.textMuted, textDecoration: 'none', letterSpacing: '0.5px', marginTop: '2px' }}
           title={tr('独立全屏站，可设为屏保')}>
          ↗ cosmic.3dqiflow.com · {tr('独立全屏站')}
        </a>
      )}
    </div>
  );
}

/* ───────────────── 页面 ───────────────── */

/** onExit 缺省＝独立站（无来路页）：不画返回键 */
export function CosmicScreensaver({ onExit, returnLabel }: { onExit?: () => void; returnLabel?: string }) {
  const lang = useLang();
  const [settings, setSettings] = useState<ScreensaverSettings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const flowRef = useRef({ v: settings.flowSpeed });
  flowRef.current.v = settings.flowSpeed;
  const rigRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<{ target: THREE.Vector3; enabled: boolean; update: () => void }>(null);
  const manualRef = useRef({ active: false, endedAt: -10, resume: 1 });
  /** 每条经一个侧重乘数引用（含奇经）；TemporalDriver 逐帧写，线与光点逐帧读 */
  const emphasisRefs = useMemo<EmphasisRefs>(() => new Map(ALL_MERIDIANS.map((c) => [c, { v: 1 }])), []);

  // ── 时辰引擎：只在开启时计时；离开屏保时彻底停掉 ──
  const tcfg = settings.temporal;
  useEffect(() => {
    temporalStore.configure({
      enabled: tcfg.enabled, timeSource: tcfg.timeSource, manualIndex: tcfg.manualIndex,
      previewCycleMinutes: tcfg.previewCycleMinutes, transitionMinutes: tcfg.transitionMinutes
    });
  }, [tcfg.enabled, tcfg.timeSource, tcfg.manualIndex, tcfg.previewCycleMinutes, tcfg.transitionMinutes]);
  useEffect(() => () => temporalStore.reset(), []);

  // ── 音景：开启且音频已在运行时挂上；关闭或音频未获手势时摘下。音量/密度/调中心实时跟随。 ──
  const audioState = useLiveAudioState();
  useEffect(() => {
    if (tcfg.enabled && audioState === 'running') {
      soundscapeController.attach({ density: tcfg.musicDensity, centerMidi: tcfg.tonalCenterMidi, octaveBias: tcfg.octaveBias });
    } else {
      soundscapeController.detach();
    }
  }, [tcfg.enabled, audioState]);   // eslint-disable-line react-hooks/exhaustive-deps -- 参数由下一个 effect 跟随
  useEffect(() => {
    soundscapeController.setParams({ density: tcfg.musicDensity, centerMidi: tcfg.tonalCenterMidi, octaveBias: tcfg.octaveBias });
  }, [tcfg.musicDensity, tcfg.tonalCenterMidi, tcfg.octaveBias]);
  useEffect(() => { liveAudio.setVolume(tcfg.masterVolume); }, [tcfg.masterVolume]);
  useEffect(() => {
    const onVis = () => { void liveAudio.onVisibility(document.visibilityState === 'visible'); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => () => { soundscapeController.detach(); void liveAudio.stop(1); }, []);

  const set = useCallback((patch: (d: ScreensaverSettings) => ScreensaverSettings) => {
    setSettings((d) => { const n = patch(d); saveSettings(n); return n; });
  }, []);
  const reset = () => { setSettings(DEFAULT_SETTINGS); saveSettings(DEFAULT_SETTINGS); };

  // ── 界面自动隐去：4 秒无指针动作淡出（含光标）；场景照常运行 ──
  const [uiVisible, setUiVisible] = useState(true);
  const [panelOpen, setPanelOpenState] = useState(() => panelOpenAcrossRemount);
  const setPanelOpen = useCallback((f: boolean | ((v: boolean) => boolean)) => {
    setPanelOpenState((v) => { const n = typeof f === 'function' ? f(v) : f; panelOpenAcrossRemount = n; return n; });
  }, []);
  const idleTimer = useRef<number | null>(null);
  const poke = useCallback(() => {
    setUiVisible(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setUiVisible(false), 4000);
  }, []);
  useEffect(() => { poke(); return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current); }; }, [poke]);
  const showUi = uiVisible || panelOpen;

  // ── 全屏：跟随 Fullscreen API；ESC 退全屏不等于退出屏保 ──
  const [fullscreen, setFullscreen] = useState<boolean>(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };
  // 离开屏保时若仍全屏，退出全屏；不残留监听
  useEffect(() => () => { if (document.fullscreenElement) document.exitFullscreen?.(); }, []);

  // ── 屏幕常亮：屏保在前台期间申请 Screen Wake Lock（免去改系统休眠设置）。
  //    标签页隐藏时系统会自动释放，回到前台再申请；不支持的浏览器静默跳过。 ──
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      try { sentinel = await nav.wakeLock!.request('screen'); } catch { sentinel = null; /* 低电量等策略拒绝 */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  const { camera, lights } = THREE_DEFAULTS;
  const chip = (visible: boolean): React.CSSProperties => ({
    ...toggleButtonStyle(false), position: 'fixed', zIndex: 125, fontSize: '12px', padding: '4px 10px',
    opacity: visible ? 0.28 : 0, transition: 'opacity 0.6s', pointerEvents: visible ? 'auto' : 'none'
  });

  return (
    <div className="scene-root" onPointerMove={poke}
         style={{ width: '100vw', height: '100vh', background: BACKGROUND.gradient, cursor: showUi ? 'default' : 'none' }}>
      <Canvas
        flat
        legacy
        dpr={[1, 1.5]}
        onCreated={({ gl }) => { gl.outputColorSpace = THREE.LinearSRGBColorSpace; }}
        camera={{ fov: settings.camera.fov, near: camera.near, far: camera.far, position: [0, 0.9, BASE_RADIUS] }}
        style={{ background: BACKGROUND.gradient }}
      >
        <ambientLight color={lights.ambient.color} intensity={lights.ambient.intensity} />
        <pointLight color={lights.center.color} intensity={lights.center.intensity}
                    distance={lights.center.distance} decay={0} position={[0, 1, 4]} />
        <Starfield />
        <BodyRig rigRef={rigRef} opacity={settings.bodyOpacity} flowRef={flowRef.current} visible={settings.visible} emphasis={emphasisRefs} />
        <Driver settingsRef={settingsRef} rigRef={rigRef} manualRef={manualRef} controlsRef={controlsRef} />
        <TemporalDriver refs={emphasisRefs} settingsRef={settingsRef} />
        <OrbitControls
          ref={controlsRef as never}
          enabled={settings.manualInteraction}
          enablePan={false}
          enableDamping
          dampingFactor={THREE_DEFAULTS.orbitControls.dampingFactor}
          target={[BODY_CENTER.x, BODY_CENTER.y, BODY_CENTER.z]}
          minDistance={SAFE_RADIUS * settings.bodyScale}
          maxDistance={BASE_RADIUS * 2.2}
          onStart={() => { manualRef.current.active = true; }}
          onEnd={() => { manualRef.current.active = false; manualRef.current.endedAt = performance.now() / 1000; manualRef.current.resume = 0; }}
        />
      </Canvas>

      {/* 返回（左上，极淡；悬停变亮） */}
      {onExit && <button style={{ ...chip(showUi), left: '18px', top: '16px' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = showUi ? '0.28' : '0')}
              onClick={onExit} title={`${tr('返回')} ${returnLabel}`}>
        ↩ 3DQiFlow · {returnLabel}
      </button>}
      {!onExit && <a href={MAIN_SITE} style={{ ...chip(showUi), left: '18px', top: '16px', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = showUi ? '0.28' : '0')}
              title={tr('3DQiFlow 主站：经穴图、十二经运行、方剂、条文')}>
        3DQiFlow ↗
      </a>}

      {/* 时辰信息叠层（左下，极淡；界面显现时清晰几秒） */}
      {settings.temporal.enabled && <TemporalOverlay mode={settings.temporal.overlay} bright={showUi} />}

      {/* 设置 / 全屏（右下，极淡） */}
      <div style={{ position: 'fixed', right: '18px', bottom: '16px', zIndex: 125, display: 'flex', gap: '6px',
                    opacity: showUi ? 1 : 0, transition: 'opacity 0.6s', pointerEvents: showUi ? 'auto' : 'none' }}>
        {settings.temporal.enabled && audioState !== 'running' && LiveAudio.supported() && (
          <button style={{ ...toggleButtonStyle(false), fontSize: '12px', padding: '4px 10px', opacity: 0.7, borderColor: UI.accent, color: UI.accent }}
                  onClick={() => void liveAudio.start(settings.temporal.masterVolume)} title={tr('声音需要一次点击才能开始')}>
            ♪ {tr('开始声音')}
          </button>
        )}
        <button style={{ ...toggleButtonStyle(fullscreen), fontSize: '12px', padding: '4px 10px', opacity: 0.28 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.28')}
                onClick={toggleFullscreen} title={fullscreen ? tr('退出全屏') : tr('全屏')}>⛶</button>
        <button style={{ ...toggleButtonStyle(panelOpen), fontSize: '12px', padding: '4px 10px', opacity: panelOpen ? 0.9 : 0.28 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = panelOpen ? '0.9' : '0.28')}
                onClick={() => setPanelOpen((v) => !v)} title={tr('屏保设置')}>⚙</button>
      </div>

      {panelOpen && (
        <SettingsPanel s={settings} set={set} fullscreen={fullscreen} onFullscreen={toggleFullscreen} onReset={reset} lang={lang === 'zh' ? 'zh' : 'en'} standaloneLink={!!onExit} />
      )}
    </div>
  );
}
