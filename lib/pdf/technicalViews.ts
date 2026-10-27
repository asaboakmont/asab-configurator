import { kitchenExportCorner, kitchenExportDirection } from "@/lib/render/exportCameras";
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Cabinet } from "@/types/kitchen";

export interface TechnicalImage { label: string; dataUrl: string; aspect: number; description?: string; }
export interface CabinetTechnicalImage { cabinetId: string; image: TechnicalImage; interior?: TechnicalImage; }
/** Look into the open side of the L. Equal axes give a true isometric view. */
export function kitchenIsometricDirection(cabinets: Cabinet[]) {
  return kitchenExportDirection(kitchenExportCorner(cabinets), "isometric");
}
export const cabinetKey = (c: Cabinet) => c.id ?? `${c.sku}-${c.wall}-${c.type}-${c.xPos}-${c.zPos ?? 0}`;

/** Look at both door faces of the actual handed corner, in world coordinates. */
export function cabinetTechnicalDirection(c: Cabinet, rotation: THREE.Quaternion, internalPreview = false) {
  if (internalPreview && c.type === "wall-corner") {
    const left = c.cornerSide === "STG" || /STG/.test(c.baseSku ?? c.sku);
    return new THREE.Vector3(left ? -1 : 1, .3, 1).applyQuaternion(rotation);
  }
  return c.wall === "B" ? new THREE.Vector3(1,.3,1) : c.wall === "C" ? new THREE.Vector3(-1,.3,1) : new THREE.Vector3(.5,.3,1);
}


/** A separate renderer owns its geometry/materials. Never mutate the live viewer. */
export async function captureTechnicalViews(source: THREE.Scene, cabinets: Cabinet[], internalPreview = false) {
  source.updateMatrixWorld(true);
  const roots: THREE.Object3D[] = [], worktopAndPlinths: THREE.Object3D[] = [];
  source.traverse(o => {
    if (o.userData.asab?.asabType === "cabinet") roots.push(o);
    if (o.userData.exportGLB === true && ["worktop", "plinth"].includes(o.userData.asab?.category)) worktopAndPlinths.push(o);
  });
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(1800, 1200); renderer.setPixelRatio(1);
  renderer.setClearColor(0xffffff, 1);
  const images: TechnicalImage[] = [], cabinetImages: CabinetTechnicalImage[] = [];
  const warnings: string[] = [];
  function render(objects: THREE.Object3D[], direction: THREE.Vector3, label: string, top = false, hideFronts = false): TechnicalImage | undefined {
    const scene = new THREE.Scene();
    const geometries: THREE.BufferGeometry[] = [];
    const surface = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    // Smooth handles need a filled silhouette: sharp-edge extraction misses their curved outline.
    // Keep normal depth testing so a handle cannot show through a front or worktop.
    const handleSurface = new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.DoubleSide });
    // Native WebGL lines ignore linewidth on many devices. Screen-space ribbons print reliably.
    const ink = new LineMaterial({ color: 0x111111, resolution: new THREE.Vector2(1800, 1200), alphaToCoverage: true });
    ink.linewidth = 2.2;
    const handleInk = new LineMaterial({ color: 0x080808, resolution: new THREE.Vector2(1800, 1200), alphaToCoverage: true });
    handleInk.linewidth = 3.4;
    try {
      for (const root of objects) {
        const visit = (object: THREE.Object3D, inheritedCategory?: string) => {
          const category = object.userData.asab?.category ?? inheritedCategory;
          if (!object.visible || object.userData.excludeFromGLB || object.userData.exportGLB === false) return;
          if (hideFronts && ["front", "door", "handle"].includes(category)) return;
          if (object instanceof THREE.Mesh) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            // Error/loading proxies must never masquerade as a successfully loaded model.
            if (materials.some(m => (m as THREE.MeshBasicMaterial).wireframe)) return;
            const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld); geometries.push(geometry);
            const isHandle = category === "handle";
            const solidHardware = isHandle || ["plinth", "leg", "legs", "foot", "feet"].includes(category);
            const edges = new THREE.EdgesGeometry(geometry, isHandle ? 12 : 28); geometries.push(edges);
            const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges); geometries.push(lineGeometry);
            scene.add(new THREE.Mesh(geometry, solidHardware ? handleSurface : surface), new LineSegments2(lineGeometry, isHandle ? handleInk : ink));
          }
          object.children.forEach(child => visit(child, category));
        }
        visit(root);
      }
      if (!scene.children.length) return undefined;
      const bounds = new THREE.Box3().setFromObject(scene), center = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(bounds.getSize(new THREE.Vector3()).length(), 1);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, radius * 5);
      camera.position.copy(center).addScaledVector(direction.normalize(), radius * 2);
      if (top) camera.up.set(0, 0, -1);
      camera.lookAt(center); camera.updateMatrixWorld(true);
      const viewBounds = new THREE.Box3();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z])
        viewBounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
      const size = viewBounds.getSize(new THREE.Vector3());
      const height = Math.max(size.y, size.x / 1.5, .1) * 1.16;
      camera.left=-height*.75;camera.right=height*.75;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
      renderer.render(scene,camera);
      return {label,dataUrl:renderer.domElement.toDataURL("image/png"),aspect:2/3};
    } finally { geometries.forEach(g=>g.dispose());surface.dispose();handleSurface.dispose();ink.dispose();handleInk.dispose(); }
  }
  try {
    const allowed = roots.filter(o => cabinets.some(c => cabinetKey(c) === o.userData.asab?.cabinetId));
    const seen = new Set<string>();
    // Deterministic ordering matches the cabinet numbers in the PDF.
    for (const c of cabinets) {
      const id = cabinetKey(c), root = allowed.find(o => o.userData.asab?.cabinetId === id);
      if (!root) {warnings.push(`Model indisponibil pentru ${c.displaySku ?? c.sku}.`);continue;}
      const direction = cabinetTechnicalDirection(c, root.getWorldQuaternion(new THREE.Quaternion()), internalPreview);
      const image = render([root],direction,"Contur din modelul 3D");
      if(image){
        let frontParts=0,bodyParts=0;
        root.traverse(o=>{if(o instanceof THREE.Mesh){if(["front","door"].includes(o.userData.asab?.category))frontParts++;if(o.userData.asab?.category==="carcass")bodyParts++;}});
        const frontDirection=new THREE.Vector3(0,0,1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
        const interior=frontParts&&bodyParts ? render([root],frontDirection,"Interior din modelul 3D, fara fronturi",false,true) : undefined;
        cabinetImages.push({cabinetId:id,image,interior});seen.add(id);
      }
      else warnings.push(`Geometrie indisponibila pentru ${c.displaySku ?? c.sku}.`);
      await new Promise<void>(resolve=>setTimeout(resolve, 0));
    }
    for (const wall of ["A","B","C","I","P"]) {
      const wallRoots = allowed.filter(o=>cabinets.some(c=>c.wall===wall && seen.has(cabinetKey(c)) && cabinetKey(c)===o.userData.asab?.cabinetId));
      if(!wallRoots.length)continue;
      const direction=wall==="B"?new THREE.Vector3(1,0,0):wall==="C"?new THREE.Vector3(-1,0,0):new THREE.Vector3(0,0,1);
      const image=render(wallRoots,direction,`Vedere in contur - ${wall === "I" ? "insula" : wall === "P" ? "peninsula" : `perete ${wall}`}`);
      if(image)images.push(image);
    }
    const kitchenRoots = [...allowed.filter(o=>seen.has(o.userData.asab?.cabinetId)), ...worktopAndPlinths];
    const isometricDirection = kitchenIsometricDirection(cabinets);
    const kitchen = render(kitchenRoots, isometricDirection.clone(), "Bucatarie 3D in contur");
    const openKitchen = render(kitchenRoots, isometricDirection.clone(), "Bucatarie izometrica fara fronturi", false, true);
    if(openKitchen) {
      openKitchen.description = "Vedere izometrica a configuratiei curente, cu fronturile si manerele identificate ascunse. Detaliile interioare provin din modelul 3D. Elementele neetichetate pot ramane vizibile; compartimentarea se confirma inainte de productie.";
      images.unshift(openKitchen);
    }
    if(kitchen)images.unshift(kitchen);
    const top=render(kitchenRoots,new THREE.Vector3(0,1,0),"Plan de sus - contur din modelele 3D",true);
    if(top)images.push(top);
    const worktopImage = render(worktopAndPlinths.filter(o=>o.userData.asab?.category==="worktop"),isometricDirection.clone(),"Blat - vedere izometrica");
    return {images,cabinetImages,warnings,worktopImage};
  } finally {renderer.dispose();renderer.forceContextLoss();}
}
