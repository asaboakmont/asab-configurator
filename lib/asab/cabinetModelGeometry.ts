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

/** The restored 2001 models have front planes at 288mm, versus 333mm for
 * the native CS (300mm carcass + 18mm front + 15mm wall gap).
 * Refit both arms inside the original nominal 1000 x 600mm footprint.
 * Preserve 18mm front thickness and rigid handle size; never modify source GLBs.
 * Geometry is already a private baked copy in cornerModelAnchor coordinates.
 */
export function calibrateWallCornerGeometry(geometry:THREE.BufferGeometry, sourceWidth:number, sourceDepth:number, leftHand:boolean, hardware=false) {
 const map=(v:number,extent:number,target:number)=>v<=.270?v*(.315/.270):v<=.288?v+.045:.333+(v-.288)*(target-.333)/(extent-.288);
 geometry.computeBoundingBox();const center=geometry.boundingBox!.getCenter(new THREE.Vector3());
 const mapX=(x:number)=>leftHand?1-map(sourceWidth-x,sourceWidth,1):map(x,sourceWidth,1);
 const dx=mapX(center.x)-center.x,dz=map(center.z,sourceDepth,.6)-center.z;
 const p=geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setXYZ(i,hardware?p.getX(i)+dx:mapX(p.getX(i)),p.getY(i),hardware?p.getZ(i)+dz:map(p.getZ(i),sourceDepth,.6));
 p.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
