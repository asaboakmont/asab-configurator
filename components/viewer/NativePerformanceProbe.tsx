"use client";
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject } from 'react';
export interface NativeFrameSample { dt: number; calls: number; triangles: number; geometries: number; width: number; height: number; }
/** Explicit development benchmark callback; no sampling in the normal configurator. */
export default function NativePerformanceProbe({ onSample, orbit, controlsRef, wallA, rightReturn = false }: {
  onSample: (sample: NativeFrameSample) => void; orbit: boolean; controlsRef: MutableRefObject<any>; wallA: number; rightReturn?: boolean;
}) {
  const orbitStart = useRef<number | null>(null);
  const pendingFrame = useRef<number | null>(null);
  const { gl } = useThree();
  // Sample after the main viewport render. Shadow/contact-shadow passes can reset
  // renderer.info during useFrame, so sampling there can report a one-quad blur.
  useEffect(() => addAfterEffect(() => {
    if (pendingFrame.current === null) return;
    const dt = pendingFrame.current; pendingFrame.current = null;
    onSample({ dt, calls: gl.info.render.calls, triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries, width: gl.domElement.width, height: gl.domElement.height });
  }), [gl, onSample]);
  useFrame(({ camera, clock }, dt) => {
    if (orbit && controlsRef.current) {
      if (orbitStart.current === null) orbitStart.current = clock.elapsedTime;
      const angle = .45 + Math.sin((clock.elapsedTime - orbitStart.current) * .2) * .3;
      const radius = wallA * .13;
      const target = controlsRef.current.target;
      target.set(wallA * .05, 11, 6);
      camera.position.set(target.x + (rightReturn ? -1 : 1) * Math.sin(angle) * radius, 27, target.z + Math.cos(angle) * radius);
      camera.lookAt(target);
    }
    if (!orbit) orbitStart.current = null;
    pendingFrame.current = dt * 1000;
  });
  return null;
}
