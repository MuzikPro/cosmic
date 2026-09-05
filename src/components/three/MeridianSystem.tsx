import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VESSEL_SIX, BodySexKey, meridianColor, meridianPolyline } from '../Acupoints/pointGeometry';

/**
 * 经络线与气机流（owner 2026-09-06：自经穴图抽出为共用件，屏保与经穴图同用）。
 * 一条经＝一个几何源（meridianPolyline，任督只此一份），不另造第二套坐标。
 */

/** 一条经的连线（细管，颜色随五行） */
export function MeridianLine({ code, mirrored, dim, sex, radiusScale = 1, brightness = 1, emphasisRef }: {
  code: string; mirrored: boolean; dim: boolean; sex: BodySexKey;
  /** 随镜头缩放的管径系数（经穴图按距离量化；屏保固定） */
  radiusScale?: number;
  /** 亮度系数（屏保底更暗，略提） */
  brightness?: number;
  /** 时辰侧重（屏保）：逐帧读取的乘数，缺省＝不侧重，外观与从前完全一致 */
  emphasisRef?: { v: number };
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const baseOpacityRef = useRef(1);
  useFrame(() => {
    if (!emphasisRef || !matRef.current) return;
    matRef.current.opacity = Math.min(1, baseOpacityRef.current * emphasisRef.v);
  });
  // 奇经贴着侧面轮廓走：正面看恰与体表亮边（rim 光）重叠，0.004 的细管
  // 会整段淹没在边光里（owner 2026-08-26 报「阳跷正面丢失」的真因——
  // 线在、几何对，只是被边光盖了）。奇经加粗提亮，压得住边光。
  const vessel = VESSEL_SIX.includes(code);
  const geo = useMemo(() => {
    const pts = meridianPolyline(code, mirrored, sex);
    if (pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
    return new THREE.TubeGeometry(curve, Math.max(48, pts.length * 6), 0.0040 * radiusScale * (vessel ? 2.6 : 1), 6, false);
  }, [code, mirrored, radiusScale, sex, vessel]);
  if (!geo) return null;
  const c = meridianColor(code);
  const base = dim ? 0.12 : vessel ? 0.95 : 0.75;
  baseOpacityRef.current = Math.min(1, base * brightness);
  return (
    // renderOrder=2：透明排序可能让体表（含亮边）后画，把贴边的线冲淡——
    // 线永远最后画，边光盖不掉它
    <mesh geometry={geo} renderOrder={2}>
      <meshBasicMaterial ref={matRef} color={c} transparent opacity={baseOpacityRef.current} depthWrite={false} />
    </mesh>
  );
}

/**
 * 气机流动：沿穴序推进的光点。穴序即经气方向（见 pointGeometry.flowLabel），
 * 所以只需按 t 递增取点，肺经自然呈"由胸走手"。
 */
const QI_PER_LINE = 7;
export function QiFlow({ code, mirrored, speed, sex, size = 0.055, speedRef, emphasisRef }: {
  code: string; mirrored: boolean; speed: number; sex: BodySexKey; size?: number;
  /** 屏保：实时改速不重挂——优先读此引用 */
  speedRef?: { v: number };
  /** 时辰侧重：粒径与亮度乘数（缺省不侧重） */
  emphasisRef?: { v: number };
}) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const phase = useRef((code.charCodeAt(0) * 0.37 + code.charCodeAt(1) * 0.11) % 1);
  const curve = useMemo(() => {
    const pts = meridianPolyline(code, mirrored, sex);
    if (pts.length < 2) return null;
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
  }, [code, mirrored, sex]);
  const buf = useMemo(() => new Float32Array(QI_PER_LINE * 3), []);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!curve || !ref.current) return;
    const s = speedRef ? speedRef.v : speed;
    phase.current = (phase.current + Math.min(delta, 0.1) * 0.09 * s) % 1;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < QI_PER_LINE; i++) {
      curve.getPoint((phase.current + i / QI_PER_LINE) % 1, scratch);
      arr[i * 3] = scratch.x; arr[i * 3 + 1] = scratch.y; arr[i * 3 + 2] = scratch.z;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    if (emphasisRef && matRef.current) {
      matRef.current.size = size * Math.pow(emphasisRef.v, 0.75);   // 线的不透明度会在 1 封顶，突出感主要靠光点
      matRef.current.opacity = Math.min(1, 0.95 * emphasisRef.v);
    }
  });

  if (!curve) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buf, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={matRef} color={meridianColor(code)} size={size} transparent opacity={0.95}
                      blending={THREE.AdditiveBlending} sizeAttenuation depthWrite={false} />
    </points>
  );
}
