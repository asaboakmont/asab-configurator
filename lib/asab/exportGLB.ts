import * as THREE from 'three';
import type { Cabinet, Colorway, DesignCollectionId } from '@/types/kitchen';

const EXPORT_SCALE_TO_METERS = 0.1;

/** Opt in design roots with exportGLB:true. Descendants inherit inclusion.
 * excludeFromGLB:true (or exportGLB:false) prunes the entire subtree.
 * Untagged ancestors are retained as transform-only groups. */
export function cabinetExportData(cabinet: Cabinet & { id?: string }, colorway: Colorway, collection: DesignCollectionId) {
  const isFree = cabinet.placementMode === 'free';
  return { exportGLB: true, asab: {
    asabType: 'cabinet', category: 'cabinet', cabinetId: cabinet.id ?? `${cabinet.sku}-${cabinet.wall}-${cabinet.type}-${cabinet.xPos}-${cabinet.zPos ?? 0}`,
    catalogCollection: cabinet.catalogProduct?.collectionId,
    cabinetType: cabinet.type, sku: cabinet.sku, baseSku: cabinet.baseSku,
    standardWidth: cabinet.standardWidth ?? cabinet.width,
    width: cabinet.width,
    height: cabinet.height,
    depth: cabinet.depth,
    isCustom: cabinet.isCustom ?? false,
    dimensions: { width: cabinet.width, height: cabinet.height, depth: cabinet.depth, unit: 'cm' },
    placementMode: cabinet.placementMode ?? 'wall',
    wall: isFree ? null : cabinet.wall,
    positionMM: isFree && cabinet.freePosition
      ? { x: cabinet.freePosition.x * 10, z: cabinet.freePosition.z * 10 }
      : undefined,
    rotationYDegrees: isFree ? cabinet.rotationYDegrees ?? 0 : undefined,
    placement: { wall: isFree ? null : cabinet.wall, xPos: cabinet.xPos, zPos: cabinet.zPos, runSide: cabinet.runSide },
    price: cabinet.price,
    standardPrice: cabinet.standardPrice,
    customPriceBreakdown: cabinet.customPriceBreakdown,
    customization: { collection, doorDirection: cabinet.doorDirection, cornerSide: cabinet.cornerSide },
    materials: {
      door: { asabMaterialCode: colorway.id, color: colorway.doorHex, finish: colorway.finish },
      carcass: { color: colorway.carcassHex },
      worktop: { asabMaterialCode: colorway.worktop, color: colorway.worktopHex },
      handle: { asabMaterialCode: colorway.handle, color: colorway.handleHex },
      plinth: { asabMaterialCode: colorway.plinth ?? colorway.handle, color: colorway.plinthHex ?? colorway.handleHex },
    },
  }};
}

export function cabinetObjectName(cabinet: Cabinet): string {
  const sku = cabinet.baseSku ?? cabinet.sku;
  const suffix = (cabinet.id ?? `${cabinet.wall}-${cabinet.xPos}`).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${sku}_${suffix}`;
}

function serializable(data: unknown): Record<string, any> {
  const seen = new WeakSet<object>();
  return JSON.parse(JSON.stringify(data, (_key, value) => {
    if (typeof value === 'function' || typeof value === 'bigint') return undefined;
    if (value && typeof value === 'object') {
      if (value instanceof THREE.Object3D || seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  }) ?? '{}');
}

export function buildGLBHierarchy(source: THREE.Object3D) {
  const counts: Record<string, number> = {};
  let meshes = 0;
  function visit(object: THREE.Object3D, included = false, parentCabinetId?: string): THREE.Object3D | null {
    const data = object.userData;
    if (data.excludeFromGLB || data.exportGLB === false || object instanceof THREE.Camera || object instanceof THREE.Light || /Helper|TransformControls/.test(object.type)) return null;
    const design = included || data.exportGLB === true;
    const cabinetId = data.asab?.cabinetId ?? parentCabinetId;
    const children = object.children.map(child => visit(child, design, cabinetId)).filter((child): child is THREE.Object3D => child !== null);
    if (!design && !children.length) return null;
    const metadata = design ? serializable(data) : {};
    // A proxy avoids Object3D.copy JSON-serializing cyclic application userData.
    const cloneSource = Object.create(object) as THREE.Object3D;
    cloneSource.userData = metadata;
    const copy = design ? cloneSource.clone(false) : new THREE.Group();
    copy.name = object.name || (data.asab?.category ? `ASAB-${data.asab.category}-${cabinetId ?? object.uuid}` : object.type);
    copy.userData = metadata;
    if (design && cabinetId && !data.asab?.cabinetId) copy.userData.asab = { ...metadata.asab, parentCabinetId: cabinetId };
    copy.matrixAutoUpdate = false;
    if (object.matrixAutoUpdate) copy.matrix.compose(object.position, object.quaternion, object.scale);
    else copy.matrix.copy(object.matrix);
    copy.visible = true;
    if (copy instanceof THREE.Mesh && data.exportOpaque) {
      const opaque = (material: THREE.Material) => {
        const cloned = material.clone();
        cloned.opacity = 1;
        cloned.transparent = false;
        cloned.depthWrite = true;
        return cloned;
      };
      copy.material = Array.isArray(copy.material) ? copy.material.map(opaque) : opaque(copy.material);
    }
    for (const child of children) copy.add(child);
    if (design) {
      const category = data.asab?.category ?? (object instanceof THREE.Mesh ? 'mesh' : 'group');
      counts[category] = (counts[category] ?? 0) + 1;
      if (object instanceof THREE.Mesh) meshes++;
    }
    return copy;
  }
  const root = new THREE.Group();
  root.name = 'ASAB-Kitchen';
  root.userData = { asab: {
    schemaVersion: 2,
    units: 'meters',
    sourceSceneUnitsPerMeter: 10,
    exportScaleToMeters: EXPORT_SCALE_TO_METERS,
    coordinates: 'live-scene',
    upAxis: 'Y',
  } };
  // Include ancestors even when callers pass a subtree rather than the scene.
  const ancestors: THREE.Object3D[] = [];
  for (let parent = source.parent; parent; parent = parent.parent) ancestors.unshift(parent);
  let container = root;
  for (const ancestor of ancestors) {
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    if (ancestor.matrixAutoUpdate) group.matrix.compose(ancestor.position, ancestor.quaternion, ancestor.scale);
    else group.matrix.copy(ancestor.matrix);
    container.add(group);
    container = group;
  }
  const hierarchy = visit(source);
  if (!hierarchy || !meshes) throw new Error('No design meshes are ready to export.');
  container.add(hierarchy);
  root.updateMatrixWorld(true);
  return { root, counts, meshes };
}

export async function exportKitchenGLB(scene: THREE.Object3D) {
  const { root, counts, meshes } = buildGLBHierarchy(scene);
  // The viewer uses 10 Three.js units per metre. glTF/Blender interpret one unit
  // as one metre, so convert once at the exported root without touching the live scene.
  root.scale.setScalar(EXPORT_SCALE_TO_METERS);
  root.updateMatrixWorld(true);
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const result = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false, trs: false });
  if (!(result instanceof ArrayBuffer)) throw new Error('GLTFExporter did not produce a binary GLB.');
  return { buffer: result, counts, meshes };
}

export async function downloadKitchenGLB(scene: THREE.Object3D, project?: string) {
  const result = await exportKitchenGLB(scene);
  const suffix = (project || new Date().toISOString()).replace(/[^a-zA-Z0-9_-]/g, '-');
  const url = URL.createObjectURL(new Blob([result.buffer], { type: 'model/gltf-binary' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ASAB-Kitchen-${suffix}.glb`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  console.info('[ASAB GLB]', { meshes: result.meshes, counts: result.counts });
  return result;
}
