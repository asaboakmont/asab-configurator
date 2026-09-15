import * as THREE from "three";

/** Cancel cabinet width scaling around the handle centre, before mesh rotation. */
export function handleScaleCompensation(
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
  widthScale: number,
  collection: string,
): { position: [number, number, number]; scale: [number, number, number] } {
  if ((collection !== "japandi" && collection !== "franc") || !Number.isFinite(widthScale) || widthScale <= 0 || widthScale === 1) {
    return { position: [0, 0, 0], scale: [1, 1, 1] };
  }
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const center = geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
  center.multiply(new THREE.Vector3(...scale));
  center.applyEuler(new THREE.Euler(...rotation));
  center.add(new THREE.Vector3(...position));
  const inverse = 1 / widthScale;
  return { position: [center.x * (1 - inverse), 0, 0], scale: [inverse, 1, 1] };
}
