"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Loader } from "@react-three/drei";
import Experience from "./Experience";

export default function CanvasRoot() {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.6, 4], fov: 50 }}
      >
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>

      {/* Nice built-in loading UI */}
      <Loader />
    </>
  );
}