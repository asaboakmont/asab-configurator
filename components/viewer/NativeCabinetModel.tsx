"use client";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Html } from '@react-three/drei';
import { cabinetBottomCm } from '@/lib/asab/cabinetPlacement';
import { cabinetExportData, cabinetObjectName } from '@/lib/asab/exportGLB';
import { nativeAssetUrl } from "@/lib/catalog/modelAssets";
import { nativeModel, nativeProduct, installedDrainer } from '@/lib/catalog/nativeCatalogue';
import type { Cabinet, Colorway, DesignCollectionId } from '@/types/kitchen';
import { applyNativeMaterials, buildNativeModel, disposeNativeModel } from '@/lib/asab/nativeModelGeometry';

function modelUrl(original: string) {
  const compareOriginal = process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('nativeGeometry') === 'original';
  return nativeAssetUrl(original, compareOriginal);
}

// Immutable source meshes shared across instances; edited clones own their resources.
const sources = new Map<string, Promise<THREE.Group>>();
function load(url: string) {
  let promise = sources.get(url);
  if (!promise) {
    promise = fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Model indisponibil: ${url.split('/').pop()}`);
      const result = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
      result.scene.updateMatrixWorld(true);
      return result.scene;
    }).catch(error => { sources.delete(url); throw error; });
    sources.set(url, promise);
  }
  return promise;
}
export default function NativeCabinetModel({ cabinet, colorway, collection, position, rotationY }: {
  cabinet: Cabinet; colorway: Colorway; collection: DesignCollectionId; position: [number, number, number]; rotationY: number;
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [error, setError] = useState('');
  const model = nativeModel(cabinet, collection)!;
  const drainer = installedDrainer(cabinet, collection);
  const hoodFront = model.type === "wall-hood" ? nativeProduct("2010", 60, collection) : undefined;
  const { width, depth, doorDirection, drainerSku } = cabinet;
  const { doorHex, carcassHex, handleHex, finish } = colorway;
  const latestColorway = useRef(colorway);
  latestColorway.current = colorway;
  const url = modelUrl(model.modelUrl);
  const accessoryUrl = drainer ? modelUrl(drainer.modelUrl) : undefined;
  const hoodFrontUrl = hoodFront ? modelUrl(hoodFront.modelUrl) : undefined;
  useEffect(() => {
    let cancelled = false; let built: THREE.Group | undefined;
    setScene(null); setError('');
    Promise.all([load(url), accessoryUrl ? load(accessoryUrl) : Promise.resolve(undefined), hoodFrontUrl ? load(hoodFrontUrl) : Promise.resolve(undefined)])
      .then(([source, accessory, hood]) => {
        if (cancelled) return;
        built = buildNativeModel(source, model, { width, depth, doorDirection, drainerSku }, latestColorway.current, accessory, hood);
        setScene(built);
      }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; if (built) disposeNativeModel(built); };
  }, [model, url, drainer, accessoryUrl, hoodFrontUrl, width, depth, doorDirection, drainerSku]);
  useEffect(() => {
    if (scene) applyNativeMaterials(scene, { doorHex, carcassHex, handleHex, finish });
  }, [scene, doorHex, carcassHex, handleHex, finish]);
  return <group name={cabinetObjectName(cabinet)} userData={scene ? cabinetExportData({ ...cabinet, mountHeightCm: cabinetBottomCm(cabinet) }, colorway, collection) : { excludeFromGLB: true }} position={position} rotation={[0, rotationY, 0]}>
    {scene && <primitive object={scene} />}
    {error && <Html center><div role="alert" className="w-48 rounded bg-white p-2 text-xs text-red-700">{error}</div></Html>}
  </group>;
}
