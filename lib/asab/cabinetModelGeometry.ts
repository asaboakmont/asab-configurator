import * as THREE from "three";

/** Move a copied mesh into GLB scene coordinates before applying cabinet scale.
 * This keeps nested translations, rotations, and scales together for every part.
 * Source geometry and the cabinet placement origin remain unchanged.
 */
export function bakeCabinetMeshGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
}

/** Convert a legacy corner asset to a lower/back/left anchor, facing +Z.
 * One shared transform preserves the relative positions of all cabinet parts.
 * Left-hand assets were exported a quarter turn from right-hand assets.
 */
export function cornerModelAnchor(scene: THREE.Object3D, leftHand: boolean): THREE.Matrix4 {
  scene.updateWorldMatrix(true, true);
  const rotation = new THREE.Matrix4().makeRotationY(leftHand ? -Math.PI / 2 : 0);
  const bounds = new THREE.Box3();
  scene.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return;
    const geometry = (object as THREE.Mesh).geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(rotation, object.matrixWorld)));
  });
  if (bounds.isEmpty()) return rotation;
  return new THREE.Matrix4().makeTranslation(-bounds.min.x, -bounds.min.y, -bounds.min.z).multiply(rotation);
}
