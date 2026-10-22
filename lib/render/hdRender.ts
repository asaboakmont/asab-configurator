import { kitchenExportCorner, kitchenExportDirection, type KitchenCorner } from "@/lib/render/exportCameras";
import * as THREE from "three";

export type HDAngle = "left" | "right" | "front";
export interface HDSettings { exposure: number; lighting: number; samples: number; }
export interface HDImage { label: string; dataUrl: string; aspect: number; }
export const DEFAULT_HD_SETTINGS: HDSettings = { exposure: 1.2, lighting: 1, samples: 128 };
export function hdRenderKey(angle: HDAngle, preset: string, settings: HDSettings) {
  return JSON.stringify([angle, preset, settings.exposure, settings.lighting, settings.samples]);
}
export const HD_PRESETS = {
  hd: { width: 1920, height: 1080, samples: 128, label: "Full HD · 1920 × 1080" },
  qhd: { width: 2560, height: 1440, samples: 256, label: "QHD · 2560 × 1440" },
} as const;

/** Own every mutable render resource; share only read-only texture inputs. */
export function prepareHDScene(source: THREE.Scene, angle: HDAngle, aspect = 16 / 9, expectedCabinets?: number, corner?: KitchenCorner) {
  source.updateMatrixWorld(true);
  const cabinetWalls: Array<{ wall?: string; placementMode?: string }> = [];
  source.traverse(o => { if (o.userData.asab?.asabType === "cabinet") cabinetWalls.push(o.userData.asab.placement ?? { wall: o.userData.asab.wall }); });
  const exportCorner = kitchenExportCorner(cabinetWalls, corner);
  const effectiveAngle = exportCorner ? (exportCorner === "right" ? "right" : "left") : angle;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f2f1ee");
  const bounds = new THREE.Box3();
  const resources: Array<{ dispose(): void }> = [];
  let cabinetCount = 0;
  function visit(object: THREE.Object3D, included = false, category = "", inCabinet = false) {
    const data = object.userData;
    if (data.excludeFromGLB || data.exportGLB === false) return;
    const kind = data.asab?.category ?? category;
    const cabinet = inCabinet || data.asab?.asabType === "cabinet";
    const design = included || data.exportGLB === true;
    if (!object.visible && kind !== "wall") return;
    if (data.asab?.asabType === "cabinet") cabinetCount++;
    if (object instanceof THREE.Mesh && design) {
      const wall = data.asab?.wall;
      // Keep the room open toward the export camera, independently of orbit visibility.
      if (kind === "wall" && (wall === "front" || wall === (effectiveAngle === "right" ? "B" : "C") || !exportCorner && angle === "front" && wall !== "A")) return;
      const original = Array.isArray(object.material) ? object.material : [object.material];
      if (cabinet && original.some(m => (m as THREE.MeshStandardMaterial).wireframe)) {
        throw new Error("Un model este inca in incarcare sau nu a putut fi incarcat. Asteptati si incercati din nou.");
      }
      if (object instanceof THREE.SkinnedMesh || object instanceof THREE.InstancedMesh) throw new Error("Acest model necesita conversie inainte de randarea HD.");
      const materials = original.map(material => {
        const input = material as THREE.MeshStandardMaterial;
        const copy = input.isMeshStandardMaterial ? input.clone() : new THREE.MeshStandardMaterial({ color: input.color, map: input.map });
        copy.depthTest = copy.depthWrite = true;
        copy.polygonOffset = false;
        copy.envMapIntensity = 1;
        if (data.exportOpaque) { copy.opacity = 1; copy.transparent = false; }
        resources.push(copy);
        return copy;
      });
      const geometry = object.geometry.clone();
      resources.push(geometry);
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, Array.isArray(object.material) ? materials : materials[0]);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(object.matrixWorld);
      mesh.name = object.name;
      scene.add(mesh);
      if (cabinet) bounds.union(new THREE.Box3().setFromObject(mesh));
    }
    for (const child of object.children) visit(child, design, kind, cabinet);
  }
  try {
    visit(source);
    if (expectedCabinets !== undefined && cabinetCount !== expectedCabinets) throw new Error("Unele corpuri nu sunt inca incarcate. Asteptati incarcarea tuturor modelelor.");
    if (!cabinetCount || bounds.isEmpty()) throw new Error("Modelele corpurilor nu sunt pregatite. Asteptati incarcarea lor.");
    const center = bounds.getCenter(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 2000);
    const direction = kitchenExportDirection(exportCorner, angle === "front" ? "front" : angle === "left" ? "first" : "second");
    direction.normalize();
    camera.position.copy(center).add(direction);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    // Fit all eight corners with margin, for linear, corner, island and tall layouts.
    const inverseRotation = camera.quaternion.clone().invert();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let distance = 1;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = new THREE.Vector3(x, y, z).sub(center).applyQuaternion(inverseRotation);
      distance = Math.max(distance, p.z + Math.max(Math.abs(p.y) / tanV, Math.abs(p.x) / (tanV * aspect)) * 1.18);
    }
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    return { scene, camera, dispose: () => resources.forEach(resource => resource.dispose()) };
  } catch (error) {
    resources.forEach(resource => resource.dispose());
    throw error;
  }
}

function daylightEnvironment() {
  const width = 256, height = 128;
  const pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sky = Math.max(0, Math.cos(y / height * Math.PI));
    // Broad daylight and an opposing soft fill lift cabinet interiors and recesses.
    // These lights are exclusive to the HD renderer; no external HDR requests.
    const window = Math.exp(-((x / width - 0.23) ** 2 / 0.012 + (y / height - 0.34) ** 2 / 0.025));
    const fill = Math.exp(-((x / width - 0.73) ** 2 / 0.035 + (y / height - 0.38) ** 2 / 0.045));
    const value = 0.6 + sky * 0.75 + window * 6 + fill * 2.5;
    const i = (y * width + x) * 4;
    pixels.set([value, value * 0.99, value * 0.97, 1], i);
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

export async function renderKitchenHD(options: {
  source: THREE.Scene; preview: HTMLCanvasElement; angle: HDAngle;
  preset: keyof typeof HD_PRESETS; signal: AbortSignal; expectedCabinets?: number; settings?: HDSettings; corner?: KitchenCorner;
  onProgress: (samples: number, total: number) => void;
}) {
  const { WebGLPathTracer, DenoiseMaterial } = await import("three-gpu-pathtracer");
  const { FullScreenQuad } = await import("three/examples/jsm/postprocessing/Pass.js");
  const { source, preview, angle, preset, signal, onProgress } = options;
  const settings = HD_PRESETS[preset];
  const appearance = { ...DEFAULT_HD_SETTINGS, samples: settings.samples, ...options.settings };
  if (![appearance.exposure, appearance.lighting, appearance.samples].every(Number.isFinite) || appearance.samples < 1 || appearance.samples > 512 || appearance.exposure < 0.1 || appearance.exposure > 3 || appearance.lighting < 0.1 || appearance.lighting > 3) throw new Error("Setari de randare HD invalide.");
  const check = () => { if (signal.aborted) throw new DOMException("Randare anulata", "AbortError"); };
  check();
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  let prepared: ReturnType<typeof prepareHDScene> | undefined;
  let tracer: InstanceType<typeof WebGLPathTracer> | undefined;
  let environment: THREE.DataTexture | undefined;
  let shaderError = false;
  try {
    if (!renderer.extensions.has("EXT_color_buffer_float")) throw new Error("Randarea HD necesita WebGL 2 cu suport pentru texturi float. Incercati un browser desktop cu accelerare grafica.");
    renderer.setPixelRatio(1);
    renderer.setSize(settings.width, settings.height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = appearance.exposure;
    renderer.debug.onShaderError = () => { shaderError = true; };
    prepared = prepareHDScene(source, angle, 16 / 9, options.expectedCabinets, options.corner);
    environment = daylightEnvironment();
    prepared.scene.environment = environment;
    prepared.scene.environmentIntensity = appearance.lighting;
    preview.width = settings.width; preview.height = settings.height;
    const context = preview.getContext("2d");
    if (!context) throw new Error("Previzualizarea HD nu este disponibila.");
    tracer = new WebGLPathTracer(renderer);
    tracer.bounces = 5;
    tracer.filterGlossyFactor = 0.5;
    tracer.tiles.set(3, 3);
    tracer.renderDelay = 0; tracer.fadeDuration = 0; tracer.minSamples = 1;
    tracer.rasterizeScene = false;
    tracer.textureSize.set(1024, 1024);
    check();
    tracer.setScene(prepared.scene, prepared.camera);
    let shown = -1;
    while (tracer.samples < appearance.samples) {
      check();
      if (renderer.getContext().isContextLost()) throw new Error("Placa video a intrerupt randarea. Incercati Full HD sau inchideti alte file 3D.");
      tracer.renderSample();
      if (shaderError) throw new Error("Placa video nu poate compila randarea HD. Incercati alt browser cu accelerare grafica.");
      const samples = Math.floor(tracer.samples);
      if (samples !== shown) {
        shown = samples;
        if (samples > 0 && (samples % 4 === 0 || samples >= appearance.samples)) context.drawImage(renderer.domElement, 0, 0);
        onProgress(samples, appearance.samples);
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    check();
    // Edge-aware filtering of linear radiance before tone mapping; retain seams/handles.
    const denoise = new DenoiseMaterial({ map: tracer.target.texture, sigma: 2.5, kSigma: 1, threshold: 0.08 });
    const quad = new FullScreenQuad(denoise);
    try {
      renderer.setRenderTarget(null);
      quad.render(renderer);
      if (shaderError) throw new Error("Filtrarea imaginii HD nu este disponibila pe aceasta placa video.");
      context.drawImage(renderer.domElement, 0, 0);
    } finally { quad.dispose(); denoise.dispose(); }
    return await new Promise<Blob>((resolve, reject) => preview.toBlob(blob => blob ? resolve(blob) : reject(new Error("Imaginea PNG nu a putut fi creata.")), "image/png"));
  } finally {
    if (tracer) {
      // v0.0.23 dispose refers to _renderQuad, but its constructor creates _quad.
      // Keep this compatibility workaround local to the pinned export renderer.
      const internals = tracer as unknown as {
        _quad: { dispose(): void; material: THREE.Material };
        _renderQuad?: { dispose(): void; material: THREE.Material };
        _lowResPathTracer: { dispose(): void };
      };
      internals._renderQuad = internals._quad;
      tracer.dispose();
      internals._lowResPathTracer.dispose();
    }
    prepared?.dispose();
    environment?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
