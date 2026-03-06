"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 5000;
const REPEL_RADIUS = 1.8;   // world-unit radius around the mouse ray
const REPEL_STRENGTH = 0.22; // how hard particles are pushed

// ---------------------------------------------------------------------------
// Target positions — tree shape
// ---------------------------------------------------------------------------

const TRUNK_FRAC = 0.12;
const LAYER_FRACS = [0.33, 0.25, 0.18, 0.08, 0.04];
const LAYERS = [
  { baseY: 2.2, height: 2.2, radius: 2.0 },
  { baseY: 3.8, height: 1.8, radius: 1.5 },
  { baseY: 5.0, height: 1.4, radius: 1.0 },
  { baseY: 5.8, height: 1.0, radius: 0.6 },
  { baseY: 6.4, height: 0.8, radius: 0.3 },
];

function buildTargetPositions(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  let idx = 0;

  const place = (x: number, y: number, z: number) => {
    if (idx >= count) return;
    out[idx * 3] = x;
    out[idx * 3 + 1] = y;
    out[idx * 3 + 2] = z;
    idx++;
  };

  const trunkN = Math.floor(count * TRUNK_FRAC);
  for (let i = 0; i < trunkN; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.18;
    place(Math.cos(angle) * r, Math.random() * 2.4, Math.sin(angle) * r);
  }

  for (let li = 0; li < LAYERS.length; li++) {
    const { baseY, height, radius } = LAYERS[li];
    const n = Math.floor(count * LAYER_FRACS[li]);
    for (let i = 0; i < n; i++) {
      const t = Math.pow(Math.random(), 0.6);
      const y = baseY + t * height;
      const maxR = radius * (1 - t * 0.6);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * maxR;
      place(Math.cos(angle) * r, y, Math.sin(angle) * r);
    }
  }

  while (idx < count) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 1.2;
    place(Math.cos(angle) * r, 3.0 + Math.random() * 3.5, Math.sin(angle) * r);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Vertex colours — brown trunk, green canopy
// ---------------------------------------------------------------------------

function buildVertexColors(count: number, targets: Float32Array): Float32Array {
  const colors = new Float32Array(count * 3);
  const trunkColor = new THREE.Color("#8B5E3C");
  const lowColor = new THREE.Color("#22c55e");
  const highColor = new THREE.Color("#bbf7d0");

  for (let i = 0; i < count; i++) {
    const y = targets[i * 3 + 1];
    let c: THREE.Color;
    if (y < 2.5) {
      c = trunkColor;
    } else {
      c = lowColor.clone().lerp(highColor, Math.min((y - 2.5) / 5.0, 1));
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  return colors;
}

// ---------------------------------------------------------------------------
// Soft circle texture for round particles
// ---------------------------------------------------------------------------

function makeCircleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.85)");
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParticleTree() {
  const { geo, targets, circleTexture } = useMemo(() => {
    const targets = buildTargetPositions(PARTICLE_COUNT);

    const current = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      current[i * 3] = (Math.random() - 0.5) * 14;
      current[i * 3 + 1] = Math.random() * 9;
      current[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(current, 3));
    geo.setAttribute(
      "color",
      new THREE.BufferAttribute(buildVertexColors(PARTICLE_COUNT, targets), 3)
    );

    const circleTexture = makeCircleTexture();

    return { geo, targets, circleTexture };
  }, []);

  // Reusable unprojected mouse position (avoids per-frame allocation)
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const pos = geo.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;

    // --- mouse ray in world space ---
    mouseWorld.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
    const ox = state.camera.position.x;
    const oy = state.camera.position.y;
    const oz = state.camera.position.z;
    const rdx = mouseWorld.x - ox;
    const rdy = mouseWorld.y - oy;
    const rdz = mouseWorld.z - oz;
    const rLen = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);
    const nx = rdx / rLen, ny = rdy / rLen, nz = rdz / rLen;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const tx = targets[i3], ty = targets[i3 + 1], tz = targets[i3 + 2];

      // Lerp toward target
      pos[i3] += (tx - pos[i3]) * 0.018;
      pos[i3 + 1] += (ty - pos[i3 + 1]) * 0.018;
      pos[i3 + 2] += (tz - pos[i3 + 2]) * 0.018;

      // Breathing once settled
      const bx = pos[i3] - tx, bz = pos[i3 + 2] - tz;
      if (bx * bx + bz * bz < 0.25) {
        const phase = t * 1.2 + i * 0.137;
        pos[i3] += Math.sin(phase) * 0.018;
        pos[i3 + 1] += Math.sin(phase * 0.8 + 1.0) * 0.009;
        pos[i3 + 2] += Math.cos(phase) * 0.018;
      }

      // Mouse repulsion — closest point on ray to this particle
      const px = pos[i3] - ox, py = pos[i3 + 1] - oy, pz = pos[i3 + 2] - oz;
      const tProj = Math.max(0, px * nx + py * ny + pz * nz);
      const cpx = ox + nx * tProj;
      const cpy = oy + ny * tProj;
      const cpz = oz + nz * tProj;

      const ex = pos[i3] - cpx, ey = pos[i3 + 1] - cpy, ez = pos[i3 + 2] - cpz;
      const dist = Math.sqrt(ex * ex + ey * ey + ez * ez);

      if (dist < REPEL_RADIUS && dist > 0.001) {
        const force = ((REPEL_RADIUS - dist) / REPEL_RADIUS) * REPEL_STRENGTH;
        const inv = 1 / dist;
        pos[i3] += ex * inv * force;
        pos[i3 + 1] += ey * inv * force;
        pos[i3 + 2] += ez * inv * force;
      }
    }

    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points geometry={geo}>
      <pointsMaterial
        vertexColors
        map={circleTexture}
        alphaMap={circleTexture}
        alphaTest={0.01}
        size={0.09}
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
