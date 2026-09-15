"use client";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Html } from "@react-three/drei";
import { catalogModelPath, isCatalogModelUrl } from "@/lib/catalog/schema";
import { cabinetExportData, cabinetObjectName } from "@/lib/asab/exportGLB";
import type { Cabinet, Colorway, DesignCollectionId } from "@/types/kitchen";

function dispose(scene: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
      material.dispose();
    }
  });
  textures.forEach(texture => texture.dispose());
}
/** Preserve imported materials/hierarchy and fit the declared physical dimensions. */
export default function ImportedCabinetModel({ cabinet, colorway, collection, position, rotationY }: {
  cabinet: Cabinet; colorway: Colorway; collection: DesignCollectionId; position: [number, number, number]; rotationY: number;
}) {
  const [model, setModel] = useState<{ scene: THREE.Group; size: THREE.Vector3; center: THREE.Vector3 } | null>(null);
  const [error, setError] = useState("");
  const url = cabinet.catalogProduct?.modelUrl ?? "";
  useEffect(() => {
    const controller = new AbortController(); let loaded: THREE.Group | undefined;
    setModel(null); setError("");
    if (!isCatalogModelUrl(url)) { setError("Model GLB invalid"); return; }
    fetch(catalogModelPath(url), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Model indisponibil. Verificati sesiunea interna.");
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
      loaded = gltf.scene;
      if (controller.signal.aborted) { dispose(loaded); return; }
      const box = new THREE.Box3().setFromObject(loaded);
      const size = box.getSize(new THREE.Vector3());
      if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0)) throw new Error("Dimensiuni GLB invalide.");
      loaded.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      setModel({ scene: loaded, size, center: box.getCenter(new THREE.Vector3()) });
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => { controller.abort(); if (loaded) dispose(loaded); };
  }, [url]);
  return <group name={cabinetObjectName(cabinet)} userData={cabinetExportData(cabinet, colorway, collection)} position={position} rotation={[0, rotationY, 0]}>
    {model ? <group scale={[cabinet.width * .1 / model.size.x, cabinet.height * .1 / model.size.y, cabinet.depth * .1 / model.size.z]}>
      <group position={[-model.center.x, -model.center.y, -model.center.z]}><primitive object={model.scene} /></group>
    </group> : <mesh><boxGeometry args={[cabinet.width * .1, cabinet.height * .1, cabinet.depth * .1]} /><meshStandardMaterial color={error ? "#e9aaaa" : "#ddd6ca"} wireframe /></mesh>}
    {error && <Html center><div className="w-48 rounded bg-white p-2 text-xs text-red-700">{error}</div></Html>}
  </group>;
}
