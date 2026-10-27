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

/** Legacy Smart combines handles for perpendicular doors into one mesh.
 * Partition triangles by their nearest door plane before any rigid relocation.
 * Input is an anchored private copy in metres; originals are never changed.
 */
export function wallCornerHandleParts(geometry: THREE.BufferGeometry, sourceWidth: number, leftHand: boolean) {
 const input = geometry.index ? geometry.toNonIndexed() : geometry.clone();
 const positions = input.getAttribute('position');
 const sidePlane = leftHand ? sourceWidth - .288 : .288;
 const buckets: number[][] = [[], []];
 for (let i = 0; i < positions.count; i += 3) {
  const x = (positions.getX(i) + positions.getX(i+1) + positions.getX(i+2)) / 3;
  const z = (positions.getZ(i) + positions.getZ(i+1) + positions.getZ(i+2)) / 3;
  buckets[Math.abs(x-sidePlane) < Math.abs(z-.288) ? 0 : 1].push(i,i+1,i+2);
 }
 const parts = buckets.flatMap((vertices, face) => {
  if (!vertices.length) return [];
  const part = new THREE.BufferGeometry();
  for (const name of Object.keys(input.attributes)) {
   const attr = input.getAttribute(name);
   const values = new Float32Array(vertices.length * attr.itemSize);
   vertices.forEach((vertex, i) => {
    for (let j = 0; j < attr.itemSize; j++) values[i * attr.itemSize + j] = attr.getComponent(vertex,j);
   });
   part.setAttribute(name, new THREE.BufferAttribute(values, attr.itemSize));
  }
  return [{ geometry: part, normal: new THREE.Vector3(face === 0 ? (leftHand ? -1 : 1) : 0, 0, face === 1 ? 1 : 0) }];
 });
 input.dispose();
 return parts;
}

export function prepareWallCornerHandles(geometry: THREE.BufferGeometry, sourceWidth: number, sourceDepth: number, leftHand: boolean, align: boolean, outwardMetres: number) {
 return wallCornerHandleParts(geometry, sourceWidth, leftHand).map(part => {
  if (align) calibrateWallCornerGeometry(part.geometry, sourceWidth, sourceDepth, leftHand, true);
  // Native 700mm wall units place the handle lower edge at 15.5mm above
  // the carcass bottom. Match that baseline without resizing legacy hardware.
  part.geometry.computeBoundingBox();
  const verticalOffset = align ? .0155 - part.geometry.boundingBox!.min.y : 0;
  part.geometry.translate(part.normal.x * outwardMetres, verticalOffset, part.normal.z * outwardMetres);
  return part.geometry;
 });
}
