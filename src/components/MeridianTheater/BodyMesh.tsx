import { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { SPHERE_SHELL, BACKGROUND } from '@/styles/theme';
import type { BodyVariant } from './BodyFigure';

/**
 * 经穴图专用的体表着色（variant='atlas'）。
 *
 * 原先整具身体是一层平涂的半透明 Phong，又开着 DoubleSide + depthWrite:false，
 * 正面和背面的三角形混在一起，结果是一块没有起伏的深色影子——
 * 看不出三角肌、肋弓、膝盖在哪，穴位也就失去了参照。
 *
 * 这里改用菲涅尔（掠射角越亮）：正对镜头的地方几乎透明，转折处发亮，
 * 于是轮廓和体表起伏读得出来，而身体依旧是透的，不挡里面的经络与穴点。
 * 法线用 abs() 取绝对值，背面三角形的翻转法线才不会算出负的边缘光。
 */
const ATLAS_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATLAS_FRAG = /* glsl */ `
  uniform vec3 uFill;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uRimPower;
  uniform float uRimStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    // 掠射边缘 -> 1，正对镜头 -> 0；abs 让 DoubleSide 的背面也算对
    float fres = 1.0 - abs(dot(n, normalize(vView)));
    float rim = pow(clamp(fres, 0.0, 1.0), uRimPower) * uRimStrength;
    // 一点方向光，给躯干和四肢一点体积感，纯边缘光会显得像空壳
    float diff = abs(dot(n, normalize(vec3(0.35, 0.55, 0.9)))) * 0.35;
    vec3 col = uFill * (0.65 + diff) + uRim * rim;
    gl_FragColor = vec4(col, clamp(uOpacity + rim * 0.9, 0.0, 1.0));
  }
`;

/**
 * 解剖体剪影：NIH 3D / Visible Human 男性皮肤网格抽稀而成
 * （scripts/build-body-mesh.py 离线生成，已缩放进 bodyGeometry.BODY 同坐标系：
 *   脚底 y=-3.2、头顶 y=3.5）。
 *
 * 与 BodyFigure 一样只作半透明剪影 —— 经络路径仍是教学示意线，
 * 换成真人轮廓不等于经络定位取得解剖学权威。
 */
// public/ 下的静态资源没有内容哈希，浏览器会长期缓存。这只网格改动频繁，
// 缓存住旧版会看到**上一版的身体**，很容易被当成几何错误去查（已发生过）。
// 挂内容指纹作查询串：网格一变 URL 就变，缓存自然失效。
// 指纹由 scripts/stamp-model.py 在重建网格后写入。
const MODEL_VERSION = 'ac180c470b';
const MODEL_VERSION_F = 'e0babc992b';
// 相对 Vite base 取模型：默认 base '/' 时与从前完全一致；打包成本地壁纸（base './'，file:// 运行）时也能找到
const PUBLIC_BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
const MODEL_URL = `${PUBLIC_BASE}models/body-skin.glb?v=${MODEL_VERSION}`;
const MODEL_URL_F = `${PUBLIC_BASE}models/body-skin-f.glb?v=${MODEL_VERSION_F}`;

/** 男/女体表。两具都来自 NIH 3D / Visible Human，同一套归一化（脚底 y=-3.2、头顶 y=3.5）。 */
export type BodySex = 'male' | 'female';

export function BodyMesh(
  { variant = 'dark', opacity = 0.5, sex = 'male' }:
  { variant?: BodyVariant | 'atlas'; opacity?: number; sex?: BodySex }
) {
  const { scene } = useGLTF(sex === 'female' ? MODEL_URL_F : MODEL_URL);

  // 源网格只带 POSITION：法线在此计算一次（离线省下的体积在这里补回来）
  const geometry = useMemo(() => {
    let found: THREE.BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = (o as THREE.Mesh).geometry as THREE.BufferGeometry;
    });
    if (!found) return null;
    const g = (found as THREE.BufferGeometry).clone();
    g.computeVertexNormals();
    return g;
  }, [scene]);

  const material = useMemo(() => {
    if (variant === 'atlas') {
      return new THREE.ShaderMaterial({
        vertexShader: ATLAS_VERT,
        fragmentShader: ATLAS_FRAG,
        uniforms: {
          uFill: { value: new THREE.Color(0x2b3566) },
          uRim: { value: new THREE.Color(0x8fb6ff) },
          uOpacity: { value: opacity },
          uRimPower: { value: 2.2 },
          // 边缘光也跟着档位走。只调 uOpacity 是没用的：边缘的不透明度主要
          // 由 rim 贡献，"淡"和"清晰"看起来会一模一样。
          uRimStrength: { value: Math.min(1.0, Math.max(0.15, opacity * 3.5)) }
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false   // 同下：透明体不写深度，否则挡住体内的经络管
      });
    }
    if (variant === 'ink') {
      return new THREE.MeshBasicMaterial({
        color: BACKGROUND.paperText, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false
      });
    }
    return new THREE.MeshPhongMaterial({
      color: SPHERE_SHELL.inner,
      emissive: SPHERE_SHELL.outerDefault,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false   // 透明剪影不写深度，否则遮住体内/背面的经络管
    });
  }, [variant, opacity]);

  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} />;
}

useGLTF.preload(MODEL_URL);
