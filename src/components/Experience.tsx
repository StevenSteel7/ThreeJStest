"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import ParticleFBX from "./ParticleFBX";

// Moves the camera forward/backward along its own look direction on scroll.
// OrbitControls handles rotation; this handles depth traversal.
function ScrollDolly() {
  const { camera } = useThree();
  const velocity = useRef(0);
  const forward = useRef(new THREE.Vector3());

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      velocity.current -= e.deltaY * 0.012;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useFrame(() => {
    if (Math.abs(velocity.current) < 0.0001) return;
    camera.getWorldDirection(forward.current);
    camera.position.addScaledVector(forward.current, velocity.current);
    velocity.current *= 0.88; // damping — feels like floating through
  });

  return null;
}

export default function Experience() {
  return (
    <>
      <color attach="background" args={["#050a0e"]} />
      <ambientLight intensity={0.1} />

      <ParticleFBX url="/models/model.fbx" color="#60a5fa" />

      <ScrollDolly />

      {/* Zoom disabled — scroll is handled by ScrollDolly above */}
      <OrbitControls makeDefault enableDamping enableZoom={false} />
    </>
  );
}
