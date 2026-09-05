import { createContext, useContext, useMemo } from 'react';
import * as THREE from 'three';
import { BODY, Vec3 } from './bodyGeometry';
import { SPHERE_SHELL, BACKGROUND } from '@/styles/theme';

const BODY_OPACITY = 0.5;

/** 外观变体：dark=暗夜场景的发光剪影；ink=宣纸背景上的淡墨剪影 */
export type BodyVariant = 'dark' | 'ink';
const VariantContext = createContext<{ variant: BodyVariant; opacity: number }>({
  variant: 'dark',
  opacity: BODY_OPACITY
});

/** 两点之间的圆柱（四肢） */
function Limb({ from, to, r }: { from: Vec3; to: Vec3; r: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    const position = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize()
    );
    return { position, quaternion, length };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[r, r, length, 12]} />
      <BodyMaterial />
    </mesh>
  );
}

function BodyMaterial() {
  const { variant, opacity } = useContext(VariantContext);
  if (variant === 'ink') {
    // 宣纸上的淡墨剪影：不发光，用纸面文字棕
    return <meshBasicMaterial color={BACKGROUND.paperText} transparent opacity={opacity} />;
  }
  return (
    <meshPhongMaterial
      color={SPHERE_SHELL.inner}
      emissive={SPHERE_SHELL.outerDefault}
      emissiveIntensity={0.6}
      transparent
      opacity={opacity}
    />
  );
}

interface BodyFigureProps {
  variant?: BodyVariant;
  opacity?: number;
}

/** 直立人体示意模型（半透明剪影，非解剖学模型） */
export function BodyFigure({ variant = 'dark', opacity = BODY_OPACITY }: BodyFigureProps) {
  return (
    <VariantContext.Provider value={useMemo(() => ({ variant, opacity }), [variant, opacity])}>
      <BodyParts />
    </VariantContext.Provider>
  );
}

function BodyParts() {
  return (
    <group>
      <mesh position={BODY.head.position}>
        <sphereGeometry args={[BODY.head.radius, 24, 24]} />
        <BodyMaterial />
      </mesh>
      <mesh position={BODY.neck.position}>
        <cylinderGeometry args={[BODY.neck.radius, BODY.neck.radius, BODY.neck.height, 12]} />
        <BodyMaterial />
      </mesh>
      <mesh position={BODY.torso.position}>
        <cylinderGeometry
          args={[BODY.torso.radiusTop, BODY.torso.radiusBottom, BODY.torso.height, 16]}
        />
        <BodyMaterial />
      </mesh>
      <mesh position={BODY.pelvis.position} scale={BODY.pelvis.scale}>
        <sphereGeometry args={[BODY.pelvis.radius, 16, 16]} />
        <BodyMaterial />
      </mesh>
      {BODY.limbs.map((limb, i) => (
        <Limb key={i} from={limb.from} to={limb.to} r={limb.r} />
      ))}
      {BODY.feet.map((foot, i) => (
        <mesh key={i} position={foot.position}>
          <boxGeometry args={BODY.footSize} />
          <BodyMaterial />
        </mesh>
      ))}
    </group>
  );
}
