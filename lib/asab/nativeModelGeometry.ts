import * as THREE from 'three';
import type { NativeProduct } from '@/lib/catalog/nativeCatalogue';
import type { Cabinet, Colorway } from '@/types/kitchen';

/** SP fronts and Germain wall fronts use handleless opening across viewer/export paths. */
export function cabinetHasHandles(collection: string, sku: string, type: string): boolean {
  return !/^ASAB-SP-/i.test(sku) && !(collection === 'germain' && type.startsWith('wall'));
}

export function nativePartCategory(name: string): string {
  if (/hinge|piston|lift|plate|runner|slide|hardware/i.test(name) && !/^Door|^DrawerFront/i.test(name)) return 'hardware';
  if (/handle|profile/i.test(name)) return 'handle';
  if (/cabinet.?leg|plinth|foot|feet/i.test(name)) return 'leg';
  if (/^Door|^DrawerFront/i.test(name)) return 'front';
  return 'carcass';
}
/** Source is in metres, Y-up, carcass bottom at Y=0, front at Z=0.
 * Bake source node transforms before width edits. Never normalize against handles/legs.
 */
export function buildNativeModel(source: THREE.Group, product: NativeProduct, cabinet: Pick<Cabinet, "width" | "depth" | "doorDirection" | "drainerSku">, colorway: Colorway, drainer?: THREE.Group, hoodFront?: THREE.Group) {
  const group = new THREE.Group();
  const ratio = cabinet.width * 10 / product.widthMm;
  const widthM = cabinet.width / 100;
  const centerY = (product.bodyHeightMm - product.legHeightMm) / 2000;
  let rearZ = -product.bodyDepthMm / 1000;
  if (product.type.startsWith('tall')) {
    // Include the real back-panel thickness: some CA backs project 3mm beyond
    // the nominal carcass depth. Align that rear surface with the room wall.
    rearZ = Infinity;
    source.traverse(object => {
      if (object instanceof THREE.Mesh && nativePartCategory(object.name) === 'carcass') {
        const box = new THREE.Box3().setFromBufferAttribute(object.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(object.matrixWorld);
        rearZ = Math.min(rearZ, box.min.z);
      }
    });
    if (!Number.isFinite(rearZ)) rearZ = -product.bodyDepthMm / 1000;
  }
  const centerZ = -rearZ - cabinet.depth / 200;
  let leftFront = false, rightFront = false;
  [source, ...(hoodFront ? [hoodFront] : [])].forEach(tree => tree.traverse(object => { if (object instanceof THREE.Mesh) { leftFront ||= /^DoorLeft/.test(object.name); rightFront ||= /^DoorRight/.test(object.name); } }));
  const mirror = cabinet.doorDirection === 'D' && leftFront && !rightFront && !product.baseSku.includes('-COLT-');
  const append = (tree: THREE.Group, accessory: boolean, hood = false) => tree.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!accessory && drainer && /^Shelf\d*/i.test(object.name)) return;
    const category = accessory ? 'drainer' : nativePartCategory(object.name);
    if (category === 'handle' && !cabinetHasHandles(product.collection, product.baseSku, product.type)) return;
    if (hood && !['front', 'handle', 'hardware'].includes(category)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const positions = geometry.getAttribute('position');
    geometry.computeBoundingBox();
    const partCenter = geometry.boundingBox!.getCenter(new THREE.Vector3());
    const handleCenter = partCenter.x;
    for (let i = 0; i < positions.count; i++) {
      let x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      if (hood) {
        // 700mm donor front -> 660mm hood, retaining 1.5mm top/bottom reveals.
        // Move hardware as rigid parts, preserving its original size and edge inset.
        const delta = .7 - product.bodyHeightMm / 1000;
        y = category === 'front' ? .0015 + (y - .0015) * ((product.bodyHeightMm / 1000 - .003) / .697)
          : y - (partCenter.y > .35 ? delta : 0);
      }
      if (accessory) { x += .018; y += .082; z -= .005; }
      else x = category === 'handle' && product.collection !== 'germain' ? x + handleCenter * (ratio - 1) : x * ratio;
      if (mirror) x = widthM - x;
      positions.setXYZ(i, (x - widthM / 2) * 10, (y - centerY) * 10, (z + centerZ) * 10);
    }
    if (mirror) {
      const index = geometry.getIndex();
      if (index) for (let i = 0; i < index.count; i += 3) { const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a); }
      else { // Nonindexed meshes: reverse all attributes per triangle.
        for (const attr of Object.values(geometry.attributes) as THREE.BufferAttribute[]) for (let i = 0; i < attr.count; i += 3) {
          for (let c = 0; c < attr.itemSize; c++) { const a = attr.getComponent(i, c); attr.setComponent(i, c, attr.getComponent(i + 2, c)); attr.setComponent(i + 2, c, a); }
        }
      }
    }
    positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(original => {
      const material = original.clone() as THREE.MeshStandardMaterial;
      return material;
    });
    const mesh = new THREE.Mesh(geometry, Array.isArray(object.material) ? materials : materials[0]);
    mesh.name = object.name; mesh.castShadow = mesh.receiveShadow = true;
    // Fixed corner facings share the door finish but remain body geometry:
    // interior/doorless exports must keep these panels in place.
    const fixedFront = !accessory && /^Corner[ _-]+fixed[ _-]+panel(?:[ _-]|$)/i.test(object.name);
    mesh.userData = { asab: { category, sourceSku: accessory ? cabinet.drainerSku : product.sku,
      ...(fixedFront ? { finishRole: 'front' } : {}) } };
    group.add(mesh);
  });
  append(source, false); if (drainer) append(drainer, true); if (hoodFront) append(hoodFront, false, true);
  applyNativeMaterials(group, colorway);
  return group;
}
export function disposeNativeModel(scene: THREE.Group) {
  scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()); } });
}

export type NativeFinish = Pick<Colorway, 'doorHex' | 'carcassHex' | 'handleHex' | 'finish'>;
/** Uniform/material edits only. Geometry UUIDs, attributes and normals stay untouched. */
export function applyNativeMaterials(scene: THREE.Group, colorway: NativeFinish) {
  const updated = new Set<THREE.Material>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const category = object.userData.asab?.category;
    const frontFinish = category === 'front' || object.userData.asab?.finishRole === 'front';
    for (const original of Array.isArray(object.material) ? object.material : [object.material]) {
      if (updated.has(original)) continue;
      updated.add(original);
      const material = original as THREE.MeshStandardMaterial;
      if (frontFinish) material.color.set(colorway.doorHex);
      else if (category === 'carcass') material.color.set(colorway.carcassHex);
      if (category === 'handle') material.color.set(colorway.handleHex);
      material.roughness = frontFinish ? (colorway.finish === 'lucios' ? .2 : .65) : category === 'drainer' ? .3 : .6;
      material.metalness = ['hardware', 'handle', 'drainer'].includes(category) ? .35 : 0;
    }
  });
}
