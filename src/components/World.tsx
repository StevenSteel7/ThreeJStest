"use client";

import { RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Mesh } from "three";

function ClickableCube() {
  const ref = useRef<Mesh>(null!);
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);

  useFrame((_, dt) => {
    // simple “alive” motion; gets faster when active
    ref.current.rotation.y += dt * (active ? 2.2 : 0.6);
  });

  return (
    <mesh
      ref={ref}
      castShadow
      position={[0, 1.2, 0]}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setActive((v) => !v);
      }}
      scale={hovered ? 1.08 : 1}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

export default function World() {
  return (
    <>
      {/* Ground */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh receiveShadow rotation-x={-Math.PI / 2}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial roughness={1} />
        </mesh>
      </RigidBody>

      {/* Interactive object */}
      <RigidBody colliders="cuboid" restitution={0.2} friction={1}>
        <ClickableCube />
      </RigidBody>

      {/* A few physics blocks to prove it’s working */}
      <RigidBody colliders="cuboid" position={[1.5, 3, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial roughness={0.7} />
        </mesh>
      </RigidBody>
    </>
  );
}