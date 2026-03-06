"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three-stdlib";

const PARTICLE_COUNT = 1000;
const REPEL_RADIUS = 1.8;
const REPEL_STRENGTH = 0.22;

function samplePoints(fbx: THREE.Group): Float32Array {
  const meshes: THREE.Mesh[] = [];
  fbx.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
  });

  if (meshes.length === 0) return new Float32Array(PARTICLE_COUNT * 3);

  const targets = new Float32Array(PARTICLE_COUNT * 3);
  const tmp = new THREE.Vector3();
  const perMesh = Math.ceil(PARTICLE_COUNT / meshes.length);
  let idx = 0;

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const baked = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(baked)).build();

    for (let i = 0; i < perMesh && idx < PARTICLE_COUNT; i++, idx++) {
      sampler.sample(tmp);
      targets[idx * 3] = tmp.x;
      targets[idx * 3 + 1] = tmp.y;
      targets[idx * 3 + 2] = tmp.z;
    }

    baked.dispose();
  }

  return targets;
}

function normalise(targets: Float32Array): void {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = targets[i * 3], y = targets[i * 3 + 1], z = targets[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const scale = 6 / size;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    targets[i * 3] = (targets[i * 3] - cx) * scale;
    targets[i * 3 + 1] = (targets[i * 3 + 1] - cy) * scale;
    targets[i * 3 + 2] = (targets[i * 3 + 2] - cz) * scale;
  }
}

// Hard-edged circle — stays crisp at any camera distance
function makeCircleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0,  "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,1)");  // solid core
  grad.addColorStop(0.75, "rgba(255,255,255,0.4)"); // short soft rim
  grad.addColorStop(1.0,  "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

interface Props {
  url: string;
  color?: string;
  particleSize?: number;
}

export default function ParticleFBX({
  url,
  color = "#60a5fa",
  particleSize = 0.15,
}: Props) {
  const fbx = useFBX(url);

  const { geo, targets, circleTexture } = useMemo(() => {
    const targets = samplePoints(fbx);
    normalise(targets);

    const current = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      current[i * 3] = (Math.random() - 0.5) * 14;
      current[i * 3 + 1] = (Math.random() - 0.5) * 14;
      current[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(current, 3));

    const circleTexture = makeCircleTexture();

    return { geo, targets, circleTexture };
  }, [fbx]);

  const mouseWorld = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const pos = geo.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;

    // Mouse ray in world space
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

      // Lerp toward target
      pos[i3] += (targets[i3] - pos[i3]) * 0.02;
      pos[i3 + 1] += (targets[i3 + 1] - pos[i3 + 1]) * 0.02;
      pos[i3 + 2] += (targets[i3 + 2] - pos[i3 + 2]) * 0.02;

      // Breathing once settled
      const bx = pos[i3] - targets[i3];
      const bz = pos[i3 + 2] - targets[i3 + 2];
      if (bx * bx + bz * bz < 0.04) {
        const phase = t * 1.2 + i * 0.13;
        pos[i3] += Math.sin(phase) * 0.007;
        pos[i3 + 2] += Math.cos(phase) * 0.007;
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
        color={color}
        map={circleTexture}
        alphaMap={circleTexture}
        alphaTest={0.15}
        size={particleSize}
        sizeAttenuation={false}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}
