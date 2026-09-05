import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const COUNT = 300;

/** 远景星空（2026-08-19 审查修正 D5）：300 颗星缓慢漂移，营造"宇宙一气"氛围 */
export function Starfield() {
  const groupRef = useRef<THREE.Group>(null);

  const positions = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // 均匀散布在远处球壳上
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(Math.random() * 2 - 1);
      const r = 28 + Math.random() * 14;
      positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      positions[i * 3 + 2] = r * Math.cos(theta);
    }
    return positions;
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.008;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={0xffffff} size={0.14} transparent opacity={0.55} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}
