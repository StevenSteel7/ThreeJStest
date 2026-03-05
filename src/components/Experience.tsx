"use client";

import { Environment, OrbitControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import World from "./World";

export default function Experience() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        castShadow
        position={[3, 6, 3]}
        intensity={1.2}
        shadow-mapSize={[1024, 1024]}
      />

      <Environment preset="city" />

      {/* Physics wrapper (remove if you don't want physics yet) */}
      <Physics gravity={[0, -9.81, 0]}>
        <World />
      </Physics>

      {/* Start with OrbitControls for dev; later you can replace with your own camera rig */}
      <OrbitControls makeDefault enableDamping />
    </>
  );
}