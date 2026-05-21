"use client";
import React, { useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Cabinet, Colorway, DesignCollectionId, Obstruction, RoomConstraints, RoomFinishes, RoomWall, WallSide } from "@/types/kitchen";
import { RULES } from "@/lib/rules/resolver";
import { stripCollectionSku } from "@/data/skus";

interface KitchenSceneProps {
  cabinets: Cabinet[];
  colorway: Colorway;
  wallA: number;
  wallB?: number;
  cornerSide?: "left" | "right";
  constraints?: RoomConstraints;
  collection?: DesignCollectionId;
  roomFinishes?: RoomFinishes;
  focusWall?: WallSide | null;
  renderPreset?: RenderCameraPreset;
  editMode?: boolean;
  selectedCabinetKey?: string | null;
  onCabinetSelect?: (key: string) => void;
  onCabinetDeselect?: () => void;
  onSelectedCabinetMove?: (dir: -1 | 1) => void;
  onSelectedCabinetRemove?: () => void;
  gapAddTargets?: Array<{
    id: string;
    wall: WallSide;
    layer: "wall" | "ground";
    start: number;
    end: number;
  }>;
  onGapAdd?: (id: string) => void;
  editableWalls?: { id: WallSide; label: string }[];
  onWallEdit?: (wall: WallSide) => void;
  onExitWallEdit?: () => void;
}

export type RenderCameraPreset = "interactive" | "NW" | "NE" | "TOP";

function cabinetSceneKey(cabinet: Cabinet): string {
  return `${cabinet.sku}-${cabinet.wall}-${cabinet.type}-${cabinet.xPos}`;
}

const CM = 0.1;
const BASE_Z = (RULES.BASE_DEPTH / 2 + 5.0) * CM;
const WALL_Z = (RULES.WALL_DEPTH / 2 + 1.5) * CM;
const WORKTOP_Z = (RULES.WORKTOP_DEPTH / 2) * CM;
const WORKTOP_Y = (RULES.BASE_HEIGHT + RULES.WORKTOP_THICKNESS / 2) * CM;
const WORKTOP_VISUAL_RAISE = 0.5 * CM;
const DEFAULT_ROOM_DEPTH = 220;
const BACKSPLASH_BOTTOM = 90.5 * CM;
const BACKSPLASH_HEIGHT = 56 * CM;
const BACKSPLASH_CENTER_Y = BACKSPLASH_BOTTOM + BACKSPLASH_HEIGHT / 2;
const HANDLE_RENDER_ORDER = 50;
const HANDLE_FORWARD_OFFSET = 0.12 * CM;
const GLB_HANDLE_FORWARD_OFFSET = 1.4 * CM;
const FRONT_REVEAL_RENDER_ORDER = 8;

function roomDepthCm(wallB?: number): number {
  return (wallB ?? DEFAULT_ROOM_DEPTH) * CM;
}

const MODEL_SKUS = [
  "1003",
  "1001-DR",
  "2001-DR",
  "2001-STG",
  "1001-STG",
  "1003-HOB-60",
  "1003-HOB-80",
  "1004",
  "1005",
  "1006",
  "1007",
  "1008",
  "1010",
  "1013",
  "1014",
  "1015",
  "1015-45",
  "2004",
  "2007",
  "2008",
  "2010",
  "2013",
  "2014",
  "1011A",
  "1011B",
  "1011C",
  "1016",
];

function normalizeMaterialName(raw: unknown): string {
  const name = String(raw ?? "").trim().toLowerCase();

  if (
    name.includes("door") ||
    name === "material.001" ||
    name === "front" ||
    name.includes("front")
  ) {
    return "door";
  }

  if (name.includes("handle") || name === "material.002") {
    return "handle";
  }

  if (name.includes("plinth") || name.includes("socle") || name === "material.003") {
    return "plinth";
  }

  if (name.includes("oven")) {
    return "oven";
  }

  if (name.includes("glass")) {
    return "glass";
  }

  return "carcass";
}

function hasNonUnitScale(object: THREE.Object3D | null | undefined): boolean {
  if (!object) return false;
  const scale = new THREE.Vector3();
  object.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  return Math.abs(scale.x - 1) > 0.000001 ||
    Math.abs(scale.y - 1) > 0.000001 ||
    Math.abs(scale.z - 1) > 0.000001;
}

const COLLECTION_MODEL_PREFIX: Record<DesignCollectionId, string> = {
  japandi: "jpn",
  germain: "grm",
  franc: "frc",
};

function collectionModelCandidates(sku: string, collection: DesignCollectionId): string[] {
  const prefix = COLLECTION_MODEL_PREFIX[collection];
  return [
    `/${collection}/${sku}-${prefix}.glb`,
    `/${collection}/${prefix}-${sku}.glb`,
    `/models/${collection}/${sku}-${prefix}.glb`,
    `/models/${collection}/${prefix}-${sku}.glb`,
    `/models/${sku}.glb`,
  ];
}

function modelBasePath(collection: DesignCollectionId): string {
  return `/models/${collection}/`;
}

async function fetchModelBuffer(sku: string, collection: DesignCollectionId): Promise<ArrayBuffer> {
  const errors: string[] = [];
  for (const path of collectionModelCandidates(sku, collection)) {
    const response = await fetch(path);
    if (response.ok) return response.arrayBuffer();
    errors.push(`${path}: ${response.status}`);
  }
  throw new Error(errors.join("; "));
}

function createDoorMaterial(colorway: Colorway): THREE.Material {
  const common = {
    color: colorway.doorHex,
    depthWrite: true,
    depthTest: true,
    transparent: false,
    side: THREE.DoubleSide,
    vertexColors: false,
  };

  if (colorway.finish === "lucios") {
    return new THREE.MeshPhysicalMaterial({
      ...common,
      roughness: 0.09,
      metalness: 0.02,
      envMapIntensity: 1.55,
      clearcoat: 0.78,
      clearcoatRoughness: 0.12,
      reflectivity: 0.55,
      sheen: 0,
    });
  }

  return new THREE.MeshStandardMaterial({
    ...common,
    roughness: colorway.finish === "furnir" ? 0.74 : 0.62,
    metalness: 0,
    envMapIntensity: colorway.finish === "furnir" ? 0.34 : 0.24,
  });
}

export default function KitchenScene({
  cabinets,
  colorway,
  wallA,
  wallB,
  cornerSide = "right",
  constraints,
  collection = "japandi",
  roomFinishes,
  focusWall,
  renderPreset = "interactive",
  editMode = false,
  selectedCabinetKey,
  onCabinetSelect,
  onCabinetDeselect,
  onSelectedCabinetMove,
  onSelectedCabinetRemove,
  gapAddTargets = [],
  onGapAdd,
  editableWalls = [],
  onWallEdit,
  onExitWallEdit,
}: KitchenSceneProps) {
  const midX = (wallA * CM) / 2;
  const controlsRef = React.useRef<any>(null);

  return (
    <Canvas
      shadows
      dpr={renderPreset === "interactive" ? [1, 2] : [2, 3]}  // higher for snapshots
      onPointerMissed={() => {
        if (editMode) onCabinetDeselect?.();
      }}
      camera={{ position: [midX, wallA * CM * 0.8, wallA * CM * 1.8], fov: 55, near: 0.1, far: 1000 }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        preserveDrawingBuffer: true,
      }}
    >
      <SceneQualitySetup />
      <ConstructionPaperBackground />
      <SoftShadows size={18} samples={12} focus={0.75} />
      <OrbitControls
        ref={controlsRef}
        enablePan
        zoomToCursor
        minPolarAngle={Math.PI / 10}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2}
        maxDistance={95}
        target={[midX, 1.2, 0.315]}
      />
      <WallEditOrbitExit
        focusWall={renderPreset === "interactive" ? focusWall : null}
        wallA={wallA}
        wallB={wallB}
        controlsRef={controlsRef}
        onExit={onExitWallEdit}
      />
      <WallFocusCamera focusWall={renderPreset === "interactive" ? focusWall : null} wallA={wallA} wallB={wallB} controlsRef={controlsRef} />
      <RenderPresetCamera
        preset={renderPreset}
        cabinets={cabinets}
        wallA={wallA}
        wallB={wallB}
        controlsRef={controlsRef}
      />

      <hemisphereLight args={["#fffaf0", "#eee7da", 1.05]} />
      <ambientLight intensity={0.52} />
      <directionalLight
        position={[4.5, 8, 5.5]}
        intensity={1.75}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.00035}
        shadow-normalBias={0.018}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
      />
      <directionalLight position={[-6, 7, 4]} intensity={0.58} color="#fff7e8" />
      <directionalLight position={[0, 6, -5]} intensity={0.42} color="#f7fbff" />
      <directionalLight position={[midX, 4.2, 5.2]} intensity={0.34} color="#fff8ee" />
      <pointLight position={[midX, 24 * CM, 3.5]} intensity={0.52} color="#fff1d6" />

      <Room wallA={wallA} wallB={wallB} cornerSide={cornerSide} roomFinishes={roomFinishes} />
      <ConstraintMarkers constraints={constraints} wallA={wallA} />
      {!editMode && renderPreset === "interactive" && (
        <InSceneWallEditButtons
          walls={editableWalls}
          wallA={wallA}
          wallB={wallB}
          cabinets={cabinets}
          onWallEdit={onWallEdit}
        />
      )}
      {editMode && (
        <GapAddButtons
          targets={gapAddTargets}
          wallA={wallA}
          cabinets={cabinets}
          onGapAdd={onGapAdd}
        />
      )}

      {cabinets.map((cab, i) => {
        const key = cabinetSceneKey(cab);
        return (
        <CabinetMesh
          key={`${cab.sku}-${cab.wall}-${cab.type}-${i}-${cab.doorDirection}`}
          cabinet={cab}
          colorway={colorway}
          wallA={wallA}
          cornerSide={cornerSide}
          collection={collection}
          editMode={editMode}
          selected={selectedCabinetKey === key}
          onSelect={onCabinetSelect ? () => onCabinetSelect(key) : undefined}
          onMoveSelected={onSelectedCabinetMove}
          onRemoveSelected={onSelectedCabinetRemove}
        />
        );
      })}

      <WorktopMerged
        cabinets={cabinets.filter(
          (c) =>
            !["wall", "wall-corner", "wall-hood", "tall", "tall-oven", "tall-fridge"].includes(
              c.type
            )
        )}
        colorway={colorway}
        wallA={wallA}
      />

      <RunKickerPlinths
        cabinets={cabinets}
        colorway={colorway}
        wallA={wallA}
        wallB={wallB}
        cornerSide={cornerSide}
      />

      <ContactShadows
        position={[midX, 0.012, wallB ? (wallB * CM) / 2 : 1.8]}
        opacity={0.22}
        scale={Math.max(6, wallA * CM + 4)}
        blur={2.8}
        far={4.5}
        resolution={1024}
        color="#6b6258"
      />
    </Canvas>
  );
}

function SceneQualitySetup() {
  const { gl } = useThree();

  React.useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.22;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);

  return null;
}

function ConstructionPaperBackground() {
  const { scene } = useThree();
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    const base = hexToRgbObject("#f7f8f7");

    ctx.fillStyle = "#f7f8f7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const smallGrid = 32;
    const largeGrid = 128;
    for (let x = 0; x <= canvas.width; x += smallGrid) {
      ctx.strokeStyle = x % largeGrid === 0 ? "rgba(118,128,138,0.16)" : "rgba(118,128,138,0.07)";
      ctx.lineWidth = x % largeGrid === 0 ? 1.1 : 0.65;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += smallGrid) {
      ctx.strokeStyle = y % largeGrid === 0 ? "rgba(118,128,138,0.16)" : "rgba(118,128,138,0.07)";
      ctx.lineWidth = y % largeGrid === 0 ? 1.1 : 0.65;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvas.width, y + 0.5);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(512, 460, 120, 512, 512, 780);
    vignette.addColorStop(0, "rgba(255,255,255,0.2)");
    vignette.addColorStop(0.62, "rgba(247,248,247,0.02)");
    vignette.addColorStop(1, "rgba(150,158,164,0.12)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 7000; i++) {
      const n = deterministicNoise(i, 97) * 18 - 9;
      const alpha = 0.025 + deterministicNoise(i, 101) * 0.035;
      ctx.fillStyle = `rgba(${clampRgb(base.r + n)}, ${clampRgb(base.g + n)}, ${clampRgb(base.b + n)}, ${alpha})`;
      ctx.fillRect(
        deterministicNoise(i, 103) * canvas.width,
        deterministicNoise(i, 107) * canvas.height,
        0.8 + deterministicNoise(i, 109) * 1.8,
        0.8 + deterministicNoise(i, 113) * 1.8
      );
    }

    const backgroundTexture = new THREE.CanvasTexture(canvas);
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    backgroundTexture.minFilter = THREE.LinearFilter;
    backgroundTexture.magFilter = THREE.LinearFilter;
    backgroundTexture.generateMipmaps = false;
    return backgroundTexture;
  }, []);

  React.useEffect(() => {
    scene.background = texture;
    return () => {
      if (scene.background === texture) scene.background = null;
      texture.dispose();
    };
  }, [scene, texture]);

  return null;
}

function RenderPresetCamera({
  preset,
  cabinets,
  wallA,
  wallB,
  controlsRef,
}: {
  preset: RenderCameraPreset;
  cabinets: Cabinet[];
  wallA: number;
  wallB?: number;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const wallWidth = wallA * CM;
  const roomDepth = roomDepthCm(wallB);
  const bounds = React.useMemo(() => getRenderContentBounds(cabinets, wallA), [cabinets, wallA]);
  const target = React.useMemo(() => new THREE.Vector3(bounds.centerX, 0.95, bounds.centerZ), [bounds.centerX, bounds.centerZ]);

  React.useEffect(() => {
  if (preset === "interactive") return;

  // Use the full wall width so empty sections of the wall are still visible,
  // not just the tight bounding box of cabinets.
  const fullWallSpanX = Math.max(bounds.width, wallA * CM);
  const fullWallSpanZ = Math.max(bounds.depth, (wallB ?? 0) * CM, 1);

  const perspectiveCamera = camera as THREE.PerspectiveCamera;
  const fov = preset === "TOP" ? 38 : 46;
  const halfFov = THREE.MathUtils.degToRad(fov / 2);
  const aspect = "aspect" in perspectiveCamera ? perspectiveCamera.aspect : 1;

  // Margin so cabinets aren't flush against frame edges (1.0 = exact fit).
  const FRAME_MARGIN = 1.25;

  // Fit distance considering BOTH width and height of the subject.
  const fitForWidth = (fullWallSpanX / 2) / (Math.tan(halfFov) * aspect);
  const fitForHeight = (fullWallSpanZ / 2) / Math.tan(halfFov);
  // Also account for cabinet vertical height (~2.4m room, cabinets ~2.2m).
  const verticalSubject = 2.4;
  const fitForVertical = (verticalSubject / 2) / Math.tan(halfFov);

  const fitDistance = Math.max(fitForWidth, fitForHeight, fitForVertical) * FRAME_MARGIN;
  const distance = Math.max(6.5, fitDistance);

  let position: THREE.Vector3;

  if (preset === "TOP") {
    target.set(bounds.centerX, 0, bounds.centerZ);
    const topFit = Math.max(fitForWidth, fitForHeight) * 1.45;
    position = new THREE.Vector3(bounds.centerX, Math.max(6.5, topFit), bounds.centerZ);
  } else if (preset === "NE") {
    position = new THREE.Vector3(
      bounds.centerX + distance * 0.78,
      distance * 0.55,
      bounds.centerZ + distance * 0.78
    );
  } else {
    position = new THREE.Vector3(
      bounds.centerX - distance * 0.78,
      distance * 0.55,
      bounds.centerZ + distance * 0.78
    );
  }

  camera.position.copy(position);
  camera.lookAt(target);
  if ("fov" in camera) {
    perspectiveCamera.fov = fov;
    perspectiveCamera.updateProjectionMatrix();
  }
  if (controlsRef.current?.target) {
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
  }
}, [bounds, camera, controlsRef, preset, target, wallA, wallB]);

  return null;
}

function getRenderContentBounds(cabinets: Cabinet[], wallA: number) {
  if (cabinets.length === 0) {
    const width = wallA * CM;
    return {
      centerX: width / 2,
      centerZ: 0.45,
      width: Math.max(width, 1),
      depth: 1.2,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  cabinets.forEach((cabinet) => {
    const depth = cabinet.depth * CM;
    const width = cabinet.width * CM;
    const start = cabinet.xPos * CM;
    const end = (cabinet.xPos + cabinet.width) * CM;

    if (cabinet.wall === "B") {
      minX = Math.min(minX, 0);
      maxX = Math.max(maxX, depth);
      minZ = Math.min(minZ, start);
      maxZ = Math.max(maxZ, end);
      return;
    }

    if (cabinet.wall === "C") {
      minX = Math.min(minX, wallA * CM - depth);
      maxX = Math.max(maxX, wallA * CM);
      minZ = Math.min(minZ, start);
      maxZ = Math.max(maxZ, end);
      return;
    }

    if (cabinet.wall === "I") {
      const centerZ = (cabinet.zPos ?? 140) * CM;
      minX = Math.min(minX, start);
      maxX = Math.max(maxX, end);
      minZ = Math.min(minZ, centerZ - depth / 2);
      maxZ = Math.max(maxZ, centerZ + depth / 2);
      return;
    }

    if (cabinet.wall === "P") {
      const side = cabinet.runSide ?? "right";
      minX = Math.min(minX, side === "left" ? 0 : wallA * CM - depth);
      maxX = Math.max(maxX, side === "left" ? depth : wallA * CM);
      minZ = Math.min(minZ, start);
      maxZ = Math.max(maxZ, end);
      return;
    }

    minX = Math.min(minX, start);
    maxX = Math.max(maxX, end);
    minZ = Math.min(minZ, 0);
    maxZ = Math.max(maxZ, depth);
  });

  const padding = 0.48;
  minX -= padding;
  maxX += padding;
  minZ -= padding;
  maxZ += padding;

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

function InSceneWallEditButtons({
  walls,
  wallA,
  wallB,
  cabinets,
  onWallEdit,
}: {
  walls: { id: WallSide; label: string }[];
  wallA: number;
  wallB?: number;
  cabinets: Cabinet[];
  onWallEdit?: (wall: WallSide) => void;
}) {
  const wallWidth = wallA * CM;
  const roomDepth = roomDepthCm(wallB);
  const wallCeilingY = 260 * CM - 0.8;
  const runTopY = 22.4;

  function wallButtonPosition(wall: WallSide): [number, number, number] {
    if (wall === "B") return [0.22, wallCeilingY, roomDepth / 2];
    if (wall === "C") return [wallWidth - 0.22, wallCeilingY, roomDepth / 2];
    if (wall === "I") {
      const island = cabinets.find((cabinet) => cabinet.wall === "I");
      return [wallWidth / 2, runTopY, (island?.zPos ?? 140) * CM];
    }
    if (wall === "P") {
      const peninsula = cabinets.find((cabinet) => cabinet.wall === "P");
      return [
        peninsula?.runSide === "left" ? 0.22 : wallWidth - 0.22,
        runTopY,
        ((peninsula?.xPos ?? 100) + (peninsula?.width ?? 60) / 2) * CM,
      ];
    }
    return [wallWidth / 2, wallCeilingY, 0.2];
  }

  return (
    <>
      {walls.map((wall) => (
        <Html key={wall.id} position={wallButtonPosition(wall.id)} center zIndexRange={[80, 0]}>
          <button
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onWallEdit?.(wall.id);
            }}
            className="whitespace-nowrap rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-900 hover:text-white"
          >
            Modifica {wall.label}
          </button>
        </Html>
      ))}
    </>
  );
}

function GapAddButtons({
  targets,
  wallA,
  cabinets,
  onGapAdd,
}: {
  targets: Array<{
    id: string;
    wall: WallSide;
    layer: "wall" | "ground";
    start: number;
    end: number;
  }>;
  wallA: number;
  cabinets: Cabinet[];
  onGapAdd?: (id: string) => void;
}) {
  function buttonPosition(target: (typeof targets)[number]): [number, number, number] {
    const center = ((target.start + target.end) / 2) * CM;
    const y = target.layer === "wall" ? 18.15 : 4.3;
    const z = target.layer === "wall" ? WALL_Z + 0.18 : BASE_Z + 0.18;
    if (target.wall === "B") return [z, y, center];
    if (target.wall === "C") return [wallA * CM - z, y, center];
    if (target.wall === "P") {
      const peninsula = cabinets.find((cabinet) => cabinet.wall === "P");
      const x = peninsula?.runSide === "left" ? BASE_Z + 0.18 : wallA * CM - BASE_Z - 0.18;
      return [x, y, center];
    }
    if (target.wall === "I") {
      const island = cabinets.find((cabinet) => cabinet.wall === "I");
      return [center, y, (island?.zPos ?? 140) * CM + 0.18];
    }
    return [center, y, z];
  }

  return (
    <>
      {targets.map((target) => (
        <ViewportAddButton
          key={target.id}
          position={buttonPosition(target)}
          onAdd={() => onGapAdd?.(target.id)}
        />
      ))}
    </>
  );
}

function WallFocusCamera({
  focusWall,
  wallA,
  wallB,
  controlsRef,
}: {
  focusWall?: WallSide | null;
  wallA: number;
  wallB?: number;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const roomDepth = roomDepthCm(wallB);
  const wallWidth = wallA * CM;
  const midX = wallWidth / 2;
  const depthMid = roomDepth / 2;
  const viewport = useThree((state) => state.size);
  const aspect = Math.max(0.75, viewport.width / Math.max(1, viewport.height));

  useFrame(() => {
    if ("fov" in camera) {
      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      const targetFov = focusWall === "B" || focusWall === "C" ? 72 : focusWall ? 62 : 55;
      perspectiveCamera.fov = THREE.MathUtils.lerp(perspectiveCamera.fov, targetFov, 0.18);
      perspectiveCamera.updateProjectionMatrix();
    }
    if (!focusWall) return;
    const fov = "fov" in camera ? THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) : THREE.MathUtils.degToRad(55);
    const view = wallView(focusWall, wallWidth, roomDepth, midX, depthMid, aspect, fov);
    camera.position.lerp(view.position, 0.34);
    if (controlsRef.current?.target) {
      controlsRef.current.target.lerp(view.target, 0.34);
      controlsRef.current.update();
    } else {
      camera.lookAt(view.target);
    }
  });

  return null;
}

function WallEditOrbitExit({
  focusWall,
  wallA,
  wallB,
  controlsRef,
  onExit,
}: {
  focusWall?: WallSide | null;
  wallA: number;
  wallB?: number;
  controlsRef: React.MutableRefObject<any>;
  onExit?: () => void;
}) {
  const { camera } = useThree();
  const exitedRef = React.useRef(false);
  const reachedHotspotRef = React.useRef(false);
  const roomDepth = roomDepthCm(wallB);
  const wallWidth = wallA * CM;
  const midX = wallWidth / 2;
  const depthMid = roomDepth / 2;
  const viewport = useThree((state) => state.size);
  const aspect = Math.max(0.75, viewport.width / Math.max(1, viewport.height));

  React.useEffect(() => {
    exitedRef.current = false;
    reachedHotspotRef.current = false;
  }, [focusWall]);

  useFrame(() => {
    if (!focusWall || exitedRef.current || !controlsRef.current?.target) return;
    const fov = "fov" in camera
      ? THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov)
      : THREE.MathUtils.degToRad(55);
    const expected = wallView(focusWall, wallWidth, roomDepth, midX, depthMid, aspect, fov);
    const expectedDirection = new THREE.Vector3().subVectors(expected.position, expected.target).setY(0).normalize();
    const currentDirection = new THREE.Vector3().subVectors(camera.position, controlsRef.current.target).setY(0).normalize();
    if (expectedDirection.lengthSq() === 0 || currentDirection.lengthSq() === 0) return;

    const angle = expectedDirection.angleTo(currentDirection);
    if (angle < THREE.MathUtils.degToRad(12)) {
      reachedHotspotRef.current = true;
    }
    if (reachedHotspotRef.current && angle > THREE.MathUtils.degToRad(52)) {
      exitedRef.current = true;
      onExit?.();
    }
  });

  return null;
}

function wallView(
  wall: WallSide,
  wallWidth: number,
  roomDepth: number,
  midX: number,
  depthMid: number,
  aspect: number,
  fov: number
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const height = 13.2;
  const targetY = 6.3;
  const fitDistance = (span: number, minDistance = 8.5) =>
    Math.max(minDistance, (span / 2) / (Math.tan(fov / 2) * Math.max(0.55, aspect)) * 1.48);
  const frontDistance = fitDistance(wallWidth);
  const sideFrameSpan = Math.max(roomDepth, 18);
  const sideVerticalSpan = 24;
  const sideDistance = Math.max(
    fitDistance(sideFrameSpan, 22),
    (sideVerticalSpan / 2) / Math.tan(fov / 2) * 2.05
  );
  if (wall === "B") {
    return {
      position: new THREE.Vector3(sideDistance, height, depthMid),
      target: new THREE.Vector3(0.34, targetY, depthMid),
    };
  }
  if (wall === "C") {
    return {
      position: new THREE.Vector3(wallWidth - sideDistance, height, depthMid),
      target: new THREE.Vector3(wallWidth - 0.34, targetY, depthMid),
    };
  }
  if (wall === "I" || wall === "P") {
    return {
      position: new THREE.Vector3(midX, height + 0.45, roomDepth + fitDistance(Math.max(wallWidth, roomDepth)) * 0.35),
      target: new THREE.Vector3(midX, 0.78, depthMid),
    };
  }
  return {
    position: new THREE.Vector3(midX, height, frontDistance),
    target: new THREE.Vector3(midX, targetY, 0.15),
  };
}

function Room({
  wallA,
  wallB,
  cornerSide = "right",
  roomFinishes,
}: {
  wallA: number;
  wallB?: number;
  cornerSide?: "left" | "right";
  roomFinishes?: RoomFinishes;
}) {
  const floorW = wallA * CM;
  const roomD = roomDepthCm(wallB);
  const wallH = 260 * CM;
  const wallThickness = 6 * CM;
  const floorThickness = 6 * CM;
  const leftWallX = 0;
  const rightWallX = wallA * CM;
  const hasSideRun = !!wallB;
  const backsplashSideWall: "left" | "right" = cornerSide === "right" ? "left" : "right";
  const { camera } = useThree();
  const [wallOpacity, setWallOpacity] = React.useState({ back: 1, left: 1, right: 1, front: 0 });

  useFrame(() => {
    const hidden = 0;
    const visible = 0.88;
    const back = camera.position.z < -0.18 ? hidden : visible;
    const left = camera.position.x < -0.22 ? hidden : visible;
    const right = camera.position.x > wallA * CM + 0.22 ? hidden : visible;
    const front = camera.position.z > roomD + 0.22 ? hidden : visible;
    setWallOpacity((current) =>
      current.back === back && current.left === left && current.right === right && current.front === front
        ? current
        : { back, left, right, front }
    );
  });

  const wallColor = roomFinishes?.wallColor ?? "#ECEFF1";
  const sideWallColor = shadeHex(wallColor, -6);
  const backsplashColor = roomFinishes?.backsplashColor ?? "#F8F7F2";
  const hasBacksplash = (roomFinishes?.backsplashTexture ?? "white-tile") !== "none";

  const wallTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const base = hexToRgbObject(wallColor);
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 2600; i++) {
      const n = deterministicNoise(i, 17) * 18 - 9;
      ctx.fillStyle = `rgba(${clampRgb(base.r + n)}, ${clampRgb(base.g + n)}, ${clampRgb(base.b + n)}, 0.18)`;
      ctx.fillRect(
        deterministicNoise(i, 3) * canvas.width,
        deterministicNoise(i, 7) * canvas.height,
        1 + deterministicNoise(i, 11) * 1.5,
        1 + deterministicNoise(i, 13) * 1.5
      );
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    return texture;
  }, [wallColor]);

  const backsplashTexture = useMemo(() => {
    if (!hasBacksplash) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const base = hexToRgbObject(backsplashColor);
    ctx.fillStyle = backsplashColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tileW = roomFinishes?.backsplashTexture === "zellige" ? 54 : 64;
    const tileH = roomFinishes?.backsplashTexture === "zellige" ? 42 : 52;
    for (let y = 0; y < canvas.height + tileH; y += tileH) {
      for (let x = -tileW; x < canvas.width + tileW; x += tileW) {
        const offset = Math.floor(y / tileH) % 2 === 0 ? 0 : tileW / 2;
        const seed = x * 13 + y * 19;
        const variation = deterministicNoise(seed, 5) * 22 - 11;
        ctx.fillStyle = `rgb(${clampRgb(base.r + variation)}, ${clampRgb(base.g + variation)}, ${clampRgb(base.b + variation)})`;
        ctx.fillRect(x + offset + 1, y + 1, tileW - 2, tileH - 2);
        ctx.strokeStyle = "rgba(120,110,100,0.23)";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x + offset + 0.5, y + 0.5, tileW - 1, tileH - 1);
      }
    }

    if (roomFinishes?.backsplashTexture === "stone-light" || roomFinishes?.backsplashTexture === "stone-dark") {
      for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = roomFinishes.backsplashTexture === "stone-dark"
          ? "rgba(255,255,255,0.13)"
          : "rgba(95,85,75,0.12)";
        ctx.lineWidth = 0.6 + deterministicNoise(i, 23) * 1.8;
        ctx.beginPath();
        const startX = deterministicNoise(i, 29) * canvas.width;
        const startY = deterministicNoise(i, 31) * canvas.height;
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(
          startX + 40 * (deterministicNoise(i, 37) - 0.5),
          startY + 35 * (deterministicNoise(i, 41) - 0.5),
          startX + 80 * (deterministicNoise(i, 43) - 0.5),
          startY + 55 * (deterministicNoise(i, 47) - 0.5),
          startX + 130 * (deterministicNoise(i, 53) - 0.5),
          startY + 90 * (deterministicNoise(i, 59) - 0.5)
        );
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 1);
    return texture;
  }, [backsplashColor, hasBacksplash, roomFinishes?.backsplashTexture]);

  const woodFloorMaterial = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const planks = 6;
    const plankH = canvas.height / planks;
    const baseColor = hexToRgbObject(roomFinishes?.floorColor ?? "#CDAF83");
    const isStone = roomFinishes?.floorTexture === "gray-stone" || roomFinishes?.floorTexture === "terrazzo";
    for (let i = 0; i < planks; i++) {
      const variation = Math.sin(i * 1.7) * (isStone ? 6 : 14);
      ctx.fillStyle = `rgb(${clampRgb(baseColor.r + variation)}, ${clampRgb(baseColor.g + variation * 0.6)}, ${clampRgb(baseColor.b - variation * 0.4)})`;
      ctx.fillRect(0, i * plankH, canvas.width, plankH);
      for (let g = 0; g < 12; g++) {
        const seed = i * 100 + g;
        const x = deterministicNoise(seed, 3) * canvas.width;
        ctx.strokeStyle = `rgba(0,0,0,0.04)`;
        ctx.lineWidth = 0.5 + deterministicNoise(seed, 7);
        ctx.beginPath();
        ctx.moveTo(x, i * plankH);
        ctx.lineTo(x + (deterministicNoise(seed, 11) - 0.5) * 40, (i + 1) * plankH);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, (i + 1) * plankH);
      ctx.lineTo(canvas.width, (i + 1) * plankH);
      ctx.stroke();
    }
    if (roomFinishes?.floorTexture === "terrazzo") {
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = i % 3 === 0 ? "rgba(255,255,255,0.35)" : "rgba(40,35,30,0.18)";
        ctx.beginPath();
        ctx.arc(
          deterministicNoise(i, 17) * canvas.width,
          deterministicNoise(i, 19) * canvas.height,
          1 + deterministicNoise(i, 23) * 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.0,
    });
  }, [roomFinishes?.floorColor, roomFinishes?.floorTexture]);

  return (
    <group>
      <mesh
        receiveShadow
        position={[wallA * CM / 2, -floorThickness / 2, roomD / 2]}
      >
        <boxGeometry args={[floorW, floorThickness, roomD]} />
        <primitive object={woodFloorMaterial} />
      </mesh>

      <mesh receiveShadow visible={wallOpacity.back > 0} position={[wallA * CM / 2, wallH / 2, -wallThickness / 2]}>
        <boxGeometry args={[wallA * CM, wallH, wallThickness]} />
        <meshStandardMaterial
          color={wallColor}
          map={wallTexture}
          roughness={0.86}
          metalness={0}
          envMapIntensity={0.08}
          transparent
          opacity={wallOpacity.back}
          depthWrite={wallOpacity.back > 0.35}
        />
      </mesh>

      {hasBacksplash && (
        <mesh receiveShadow position={[wallA * CM / 2, BACKSPLASH_CENTER_Y, 0.25 * CM]}>
          <boxGeometry args={[wallA * CM, BACKSPLASH_HEIGHT, 1.5 * CM]} />
          <meshStandardMaterial
            color={backsplashColor}
            map={backsplashTexture ?? undefined}
            roughness={0.42}
            metalness={0}
            envMapIntensity={0.3}
          />
        </mesh>
      )}

      <mesh receiveShadow visible={wallOpacity.left > 0} position={[leftWallX - wallThickness / 2, wallH / 2, roomD / 2]}>
        <boxGeometry args={[wallThickness, wallH, roomD]} />
        <meshStandardMaterial
          color={sideWallColor}
          map={wallTexture}
          roughness={0.88}
          metalness={0}
          envMapIntensity={0.06}
          transparent
          opacity={wallOpacity.left}
          depthWrite={wallOpacity.left > 0.35}
        />
      </mesh>

      {hasBacksplash && hasSideRun && backsplashSideWall === "left" && (
        <mesh receiveShadow position={[leftWallX + 0.25 * CM, BACKSPLASH_CENTER_Y, roomD / 2]}>
          <boxGeometry args={[1.5 * CM, BACKSPLASH_HEIGHT, roomD]} />
          <meshStandardMaterial
            color={backsplashColor}
            map={backsplashTexture ?? undefined}
            roughness={0.42}
            metalness={0}
            envMapIntensity={0.3}
          />
        </mesh>
      )}

      <mesh receiveShadow visible={wallOpacity.right > 0} position={[rightWallX + wallThickness / 2, wallH / 2, roomD / 2]}>
        <boxGeometry args={[wallThickness, wallH, roomD]} />
        <meshStandardMaterial
          color={sideWallColor}
          map={wallTexture}
          roughness={0.88}
          metalness={0}
          envMapIntensity={0.06}
          transparent
          opacity={wallOpacity.right}
          depthWrite={wallOpacity.right > 0.35}
        />
      </mesh>

      {hasBacksplash && hasSideRun && backsplashSideWall === "right" && (
        <mesh receiveShadow position={[rightWallX - 0.25 * CM, BACKSPLASH_CENTER_Y, roomD / 2]}>
          <boxGeometry args={[1.5 * CM, BACKSPLASH_HEIGHT, roomD]} />
          <meshStandardMaterial
            color={backsplashColor}
            map={backsplashTexture ?? undefined}
            roughness={0.42}
            metalness={0}
            envMapIntensity={0.3}
          />
        </mesh>
      )}

      {hasSideRun && (
        <mesh receiveShadow visible={wallOpacity.front > 0} position={[wallA * CM / 2, wallH / 2, roomD + wallThickness / 2]}>
          <boxGeometry args={[wallA * CM, wallH, wallThickness]} />
          <meshStandardMaterial
            color={shadeHex(wallColor, -3)}
            map={wallTexture}
            roughness={0.88}
            metalness={0}
            envMapIntensity={0.06}
            transparent
            opacity={wallOpacity.front * 0.72}
            depthWrite={wallOpacity.front > 0.35}
          />
        </mesh>
      )}
    </group>
  );
}

function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function clampRgb(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function shadeHex(hex: string, amount: number): string {
  const base = hexToRgbObject(hex);
  const toHex = (value: number) => clampRgb(value).toString(16).padStart(2, "0");
  return `#${toHex(base.r + amount)}${toHex(base.g + amount)}${toHex(base.b + amount)}`;
}

function deterministicNoise(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function wallMarkerTransform({
  wall,
  xPos,
  width,
  height,
  yBottom = 0,
  wallA,
  depthOffset = 0.8,
}: {
  wall: RoomWall;
  xPos: number;
  width: number;
  height: number;
  yBottom?: number;
  wallA: number;
  depthOffset?: number;
}): { position: [number, number, number]; rotation: [number, number, number] } {
  const y = (yBottom + height / 2) * CM;
  if (wall === "B") {
    return {
      position: [depthOffset * CM, y, (xPos + width / 2) * CM],
      rotation: [0, Math.PI / 2, 0],
    };
  }
  if (wall === "C") {
    return {
      position: [wallA * CM - depthOffset * CM, y, (xPos + width / 2) * CM],
      rotation: [0, -Math.PI / 2, 0],
    };
  }
  return {
    position: [(xPos + width / 2) * CM, y, depthOffset * CM],
    rotation: [0, 0, 0],
  };
}

function ConstraintMarkers({
  constraints,
  wallA,
}: {
  constraints?: RoomConstraints;
  wallA: number;
}) {
  if (!constraints) return null;

  return (
    <group>
      {(constraints.openings ?? []).map((opening) => {
        const sill = opening.type === "window" ? opening.sillHeight ?? 90 : 0;
        const { position, rotation } = wallMarkerTransform({
          wall: opening.wall,
          xPos: opening.xPos,
          width: opening.width,
          height: opening.height,
          yBottom: sill,
          wallA,
          depthOffset: opening.type === "window" ? 0.9 : 1.1,
        });
        return (
          <group key={opening.id} position={position} rotation={rotation}>
            <OpeningMarker opening={opening} />
          </group>
        );
      })}

      {(constraints.obstructions ?? []).map((obstruction) => {
        const yBottom = obstruction.startsFromFloor === false ? obstruction.yPos ?? 0 : 0;
        const { position, rotation } = wallMarkerTransform({
          wall: obstruction.wall,
          xPos: obstruction.xPos,
          width: obstruction.width,
          height: obstruction.height,
          yBottom,
          wallA,
          depthOffset: Math.max(1, obstruction.depth / 2),
        });
        return (
          <group key={obstruction.id} position={position} rotation={rotation}>
            <ObstructionMarker obstruction={obstruction} />
          </group>
        );
      })}

      {constraints.boiler && (
        <BoilerMarker boiler={constraints.boiler} wallA={wallA} />
      )}

      {(constraints.servicePoints ?? []).map((point) => {
        const { position, rotation } = wallMarkerTransform({
          wall: point.wall,
          xPos: point.xPos,
          width: 1,
          height: 1,
          yBottom: point.heightFromFloor,
          wallA,
          depthOffset: 2.4,
        });
        return (
          <group key={point.id} position={position} rotation={rotation}>
            <ServicePointMarker point={point} />
          </group>
        );
      })}
    </group>
  );
}

function OpeningMarker({ opening }: { opening: NonNullable<RoomConstraints["openings"]>[number] }) {
  const fallback = (
    <>
      <mesh>
        <boxGeometry args={[opening.width * CM, opening.height * CM, 1.6 * CM]} />
        <meshStandardMaterial
          color={opening.type === "window" ? "#9ec5ff" : "#c49a6c"}
          transparent
          opacity={0.55}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, 0, 1.0 * CM]}>
        <boxGeometry args={[opening.width * CM, 2 * CM, 2 * CM]} />
        <meshStandardMaterial color="#111111" transparent opacity={0.35} />
      </mesh>
    </>
  );

  return (
    <ConstraintModel
      src={`/openings/${opening.type}.glb`}
      basePath="/openings/"
      cacheKey={opening.type}
      targetWidth={opening.width * CM}
      targetHeight={opening.height * CM}
      targetDepth={2 * CM}
      fallback={fallback}
    />
  );
}

function ObstructionMarker({ obstruction }: { obstruction: Obstruction }) {
  const fallback = (
    <mesh>
      <boxGeometry args={[obstruction.width * CM, obstruction.height * CM, Math.max(4, obstruction.depth) * CM]} />
      <meshStandardMaterial color="#d95f43" transparent opacity={0.62} roughness={0.7} />
    </mesh>
  );

  return (
    <ConstraintModel
      src={`/obstructions/${obstruction.type}.glb`}
      basePath="/obstructions/"
      cacheKey={obstruction.type}
      targetWidth={obstruction.width * CM}
      targetHeight={obstruction.height * CM}
      targetDepth={Math.max(4, obstruction.depth) * CM}
      fallback={fallback}
    />
  );
}

function ServicePointMarker({ point }: { point: NonNullable<RoomConstraints["servicePoints"]>[number] }) {
  const fallback = (
    <>
      <mesh>
        <sphereGeometry args={[4 * CM, 16, 16]} />
        <meshStandardMaterial color={servicePointColor(point.type)} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.4 * CM]}>
        <ringGeometry args={[5 * CM, 6.5 * CM, 24]} />
        <meshBasicMaterial color={servicePointColor(point.type)} side={THREE.DoubleSide} />
      </mesh>
    </>
  );

  return (
    <ConstraintModel
      src={`/service-points/${point.type}.glb`}
      basePath="/service-points/"
      cacheKey={point.type}
      targetWidth={8 * CM}
      targetHeight={8 * CM}
      targetDepth={3 * CM}
      fallback={fallback}
    />
  );
}

function ConstraintModel({
  src,
  basePath,
  cacheKey,
  targetWidth,
  targetHeight,
  targetDepth,
  fallback,
}: {
  src: string;
  basePath: string;
  cacheKey: string;
  targetWidth: number;
  targetHeight: number;
  targetDepth: number;
  fallback: React.ReactNode;
}) {
  const [model, setModel] = React.useState<{
    meshes: {
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
    }[];
    center: THREE.Vector3;
    size: THREE.Vector3;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setModel(null);

    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${src}`);
        return response.arrayBuffer();
      })
      .then((rawBuffer) => {
        if (cancelled) return;
        const loader = new GLTFLoader();
        const buffer = rawBuffer.slice(0) as ArrayBuffer;

        loader.parse(
          buffer,
          basePath,
          (gltf: any) => {
            if (cancelled) return;
            const meshes: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
            const bounds = new THREE.Box3();

            gltf.scene.updateMatrixWorld(true);
            gltf.scene.traverse((child: any) => {
              if (!child.isMesh || !child.geometry) return;
              const geometry = child.geometry.clone();
              geometry.applyMatrix4(child.matrixWorld);
              if (geometry.attributes.normal) geometry.deleteAttribute("normal");
              geometry.computeVertexNormals();

              const material = Array.isArray(child.material)
                ? child.material[0]?.clone?.() ?? new THREE.MeshStandardMaterial({ color: "#d95f43" })
                : child.material?.clone?.() ?? new THREE.MeshStandardMaterial({ color: "#d95f43" });

              bounds.expandByObject(new THREE.Mesh(geometry));
              meshes.push({ geometry, material });
            });

            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            bounds.getSize(size);
            bounds.getCenter(center);
            if (meshes.length === 0 || size.x === 0 || size.y === 0 || size.z === 0) {
              setModel(null);
              return;
            }
            setModel({ meshes, center, size });
          },
          () => setModel(null)
        );
      })
      .catch(() => {
        if (!cancelled) setModel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [src, basePath, cacheKey]);

  if (!model) return <>{fallback}</>;

  const scale: [number, number, number] = [
    targetWidth / model.size.x,
    targetHeight / model.size.y,
    targetDepth / model.size.z,
  ];
  const offset: [number, number, number] = [
    -model.center.x * scale[0],
    -model.center.y * scale[1],
    -model.center.z * scale[2],
  ];

  return (
    <group position={offset} scale={scale}>
      {model.meshes.map((mesh, index) => (
        <mesh
          key={index}
          geometry={mesh.geometry}
          material={mesh.material}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

function BoilerMarker({ boiler, wallA }: { boiler: NonNullable<RoomConstraints["boiler"]>; wallA: number }) {
  const { position, rotation } = wallMarkerTransform({
    wall: boiler.wall,
    xPos: boiler.xPos,
    width: boiler.width,
    height: boiler.height,
    yBottom: boiler.yPos ?? RULES.WALL_CAB_FROM_FLOOR,
    wallA,
    depthOffset: Math.max(2, boiler.depth / 2),
  });

  const fallback = (
    <>
      <mesh>
        <boxGeometry args={[boiler.width * CM, boiler.height * CM, Math.max(6, boiler.depth) * CM]} />
        <meshStandardMaterial color="#6b7280" transparent opacity={0.7} roughness={0.65} />
      </mesh>
      <mesh position={[0, -(boiler.height / 2 + boiler.pipeClearance / 2) * CM, 0]}>
        <boxGeometry args={[(boiler.width + boiler.pipeClearance * 2) * CM, boiler.pipeClearance * CM, 2 * CM]} />
        <meshStandardMaterial color="#ef4444" transparent opacity={0.45} />
      </mesh>
    </>
  );

  return (
    <group position={position} rotation={rotation}>
      <ConstraintModel
        src="/technical/boiler.glb"
        basePath="/technical/"
        cacheKey="boiler"
        targetWidth={boiler.width * CM}
        targetHeight={boiler.height * CM}
        targetDepth={Math.max(6, boiler.depth) * CM}
        fallback={fallback}
      />
    </group>
  );
}

function servicePointColor(type: string): string {
  if (type.includes("water") || type === "drain") return "#2563eb";
  if (type === "gas") return "#f59e0b";
  if (type.includes("hood")) return "#64748b";
  return "#16a34a";
}

class GLBErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function CabinetMeshGLB({
  cabinet,
  colorway,
  collection,
  posX,
  posY,
  posZ,
  rotY,
  doorDirection,
}: {
  cabinet: Cabinet;
  colorway: Colorway;
  collection: DesignCollectionId;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  doorDirection: "S" | "D";
}) {
  const { sku } = cabinet;
  const baseSku = cabinet.baseSku ?? stripCollectionSku(sku);

  const [meshes, setMeshes] = React.useState<
    {
      geometry: THREE.BufferGeometry;
      matName: string;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }[]
  >([]);

  const carcassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.carcassHex,
        roughness: 0.68,
        metalness: 0,
        envMapIntensity: 0.35,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    [colorway.carcassHex]
  );

  const doorMat = useMemo(
    () => createDoorMaterial(colorway),
    [colorway]
  );

  const handleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.handleHex,
        roughness: colorway.handle === "inox" ? 0.28 : 0.46,
        metalness: colorway.handle === "inox" ? 0.32 : 0.08,
        envMapIntensity: 0.55,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    [colorway.handleHex, colorway.handle]
  );

  const plinthMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1C1C1A",
        roughness: 0.85,
        metalness: 0.05,
        envMapIntensity: 0.25,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    []
  );

  const ovenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1A1A1A",
        roughness: 0.35,
        metalness: 0.65,
        envMapIntensity: 1.4,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    []
  );

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#BFC7D1",
        roughness: 0.05,
        metalness: 0,
        envMapIntensity: 1.4,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    []
  );

  React.useEffect(() => {
    let cancelled = false;

    fetchModelBuffer(baseSku, collection)
      .then((rawBuffer) => {
        if (cancelled) return;
        const buffer = rawBuffer.slice(0) as ArrayBuffer;
        const loader = new GLTFLoader();
        const basePath = modelBasePath(collection);

        loader.parse(
          buffer,
          basePath,
          (gltf: any) => {
            if (cancelled) return;

            const found: {
              geometry: THREE.BufferGeometry;
              matName: string;
              position: [number, number, number];
              rotation: [number, number, number];
              scale: [number, number, number];
            }[] = [];

            gltf.scene.updateMatrixWorld(true);

            gltf.scene.traverse((child: any) => {
              if (!child.isMesh || !child.geometry) return;

              const rawMatName = Array.isArray(child.material)
                ? child.material[0]?.name
                : child.material?.name ?? "carcass";

              const matName = normalizeMaterialName(rawMatName);

              const geometry = child.geometry.clone();
              const shouldBakeParentTransform =
                matName === "handle" &&
                hasNonUnitScale(child.parent);

              if (shouldBakeParentTransform) {
                geometry.applyMatrix4(child.matrixWorld);
              }

              if (geometry.attributes.color) {
                geometry.deleteAttribute("color");
              }

              if (geometry.attributes.normal) {
                geometry.deleteAttribute("normal");
              }

              geometry.computeVertexNormals();

              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (!mat) return;
                  mat.map = null;
                  mat.normalMap = null;
                  mat.roughnessMap = null;
                  mat.metalnessMap = null;
                  mat.aoMap = null;
                  mat.emissiveMap = null;
                  mat.vertexColors = false;
                  mat.needsUpdate = true;
                });
              } else if (child.material) {
                child.material.map = null;
                child.material.normalMap = null;
                child.material.roughnessMap = null;
                child.material.metalnessMap = null;
                child.material.aoMap = null;
                child.material.emissiveMap = null;
                child.material.vertexColors = false;
                child.material.needsUpdate = true;
              }

              found.push({
                geometry,
                matName,
                position: shouldBakeParentTransform
                  ? [0, 0, 0]
                  : [child.position.x, child.position.y, child.position.z],
                rotation: shouldBakeParentTransform
                  ? [0, 0, 0]
                  : [child.rotation.x, child.rotation.y, child.rotation.z],
                scale: shouldBakeParentTransform
                  ? [1, 1, 1]
                  : [child.scale.x, child.scale.y, child.scale.z],
              });
            });

            setMeshes(found);
          },
          (err: any) => console.error(`Failed parse ${baseSku}:`, err)
        );
      })
      .catch((err: any) => console.error(`Failed fetch ${baseSku} for ${collection}:`, err));

    return () => {
      cancelled = true;
    };
  }, [baseSku, collection]);

  const matMap: Record<string, THREE.Material> = {
    carcass: carcassMat,
    door: doorMat,
    handle: handleMat,
    plinth: plinthMat,
    oven: ovenMat,
    glass: glassMat,
  };

  const doorEdgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: colorway.finish === "lucios" ? "#5b6470" : "#4b5563",
        transparent: true,
        opacity: colorway.finish === "lucios" ? 0.22 : 0.18,
        depthWrite: false,
        depthTest: true,
      }),
    [colorway.finish]
  );
  const carcassEdgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#6b7280",
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        depthTest: true,
      }),
    []
  );

  if (meshes.length === 0) return null;

  const mirrorDoor = doorDirection === "D";
  const isCorner = cabinet.type === "base-corner" || cabinet.type === "wall-corner";
  const shouldFlattenChildRotations = !isCorner && cabinet.wall !== "A" && cabinet.wall !== "I";
  const shouldPreserveChildRotation = (mesh: { matName: string }) => ["door", "handle"].includes(mesh.matName);
  const childRotation = (mesh: { matName: string; rotation: [number, number, number] }) =>
    shouldFlattenChildRotations && !shouldPreserveChildRotation(mesh) ? [0, 0, 0] as [number, number, number] : mesh.rotation;

  return (
    <group position={[posX, posY, posZ]} rotation={[0, rotY, 0]}>
      {(() => {
        const nonDoorMeshes = meshes.filter((m) => !["door", "handle"].includes(m.matName));
        const doorMeshes = meshes.filter((m) => ["door", "handle"].includes(m.matName));

        return (
          <>
            {nonDoorMeshes.map((m, i) => (
              <React.Fragment key={`c-${i}`}>
                <mesh
                  geometry={m.geometry}
                  material={matMap[m.matName] ?? carcassMat}
                  position={m.position}
                  rotation={childRotation(m)}
                  scale={[m.scale[0] * 10, m.scale[1] * 10, m.scale[2] * 10]}
                  castShadow
                  receiveShadow
                  frustumCulled={false}
                  renderOrder={m.matName === "handle" ? HANDLE_RENDER_ORDER : 0}
                />
                {m.matName === "carcass" && (
                  <MeshEdgeLines
                    geometry={m.geometry}
                    material={carcassEdgeMat}
                    position={m.position}
                    rotation={childRotation(m)}
                    scale={[m.scale[0] * 10, m.scale[1] * 10, m.scale[2] * 10]}
                  />
                )}
              </React.Fragment>
            ))}

            {doorMeshes.map((m, i) => {
              const isHandle = m.matName === "handle";
              const meshPosition: [number, number, number] = isHandle
                ? [m.position[0], m.position[1], m.position[2] + GLB_HANDLE_FORWARD_OFFSET]
                : m.position;
              return (
                <group
                  key={`d-${i}`}
                  scale={mirrorDoor && isHandle ? [-1, 1, 1] : [1, 1, 1]}
                  position={[
                    mirrorDoor && isHandle ? (cabinet.width * CM) : 0,
                    0, 0
                  ]}
                >
                  <mesh
                    geometry={m.geometry}
                    material={matMap[m.matName] ?? carcassMat}
                    position={meshPosition}
                    rotation={childRotation(m)}
                    scale={[m.scale[0] * 10, m.scale[1] * 10, m.scale[2] * 10]}
                    castShadow
                    receiveShadow
                    frustumCulled={false}
                    renderOrder={isHandle ? HANDLE_RENDER_ORDER : 1}
                  />
                  {!isHandle && (
                    <MeshEdgeLines
                      geometry={m.geometry}
                      material={doorEdgeMat}
                      position={m.position}
                      rotation={childRotation(m)}
                      scale={[m.scale[0] * 10, m.scale[1] * 10, m.scale[2] * 10]}
                    />
                  )}
                </group>
              );
            })}
          </>
        );
      })()}
    </group>
  );
}

function MeshEdgeLines({
  geometry,
  material,
  position,
  rotation,
  scale,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}) {
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(geometry, 28), [geometry]);

  React.useEffect(() => {
    return () => edgesGeometry.dispose();
  }, [edgesGeometry]);

  return (
    <lineSegments
      geometry={edgesGeometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      renderOrder={FRONT_REVEAL_RENDER_ORDER}
      frustumCulled={false}
    />
  );
}

function DoorRevealLines({
  width,
  height,
  z,
  color,
  opacity,
}: {
  width: number;
  height: number;
  z: number;
  color: string;
  opacity: number;
}) {
  const lineW = 0.45 * CM;
  const inset = 1.2 * CM;
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
      }),
    [color, opacity]
  );

  React.useEffect(() => {
    return () => material.dispose();
  }, [material]);

  return (
    <group renderOrder={FRONT_REVEAL_RENDER_ORDER}>
      <mesh material={material} position={[-width / 2 + inset, 0, z]}>
        <boxGeometry args={[lineW, height - inset * 2, 0.05 * CM]} />
      </mesh>
      <mesh material={material} position={[width / 2 - inset, 0, z]}>
        <boxGeometry args={[lineW, height - inset * 2, 0.05 * CM]} />
      </mesh>
      <mesh material={material} position={[0, height / 2 - inset, z]}>
        <boxGeometry args={[width - inset * 2, lineW, 0.05 * CM]} />
      </mesh>
      <mesh material={material} position={[0, -height / 2 + inset, z]}>
        <boxGeometry args={[width - inset * 2, lineW, 0.05 * CM]} />
      </mesh>
    </group>
  );
}

function CabinetBoxEdgeLines({
  width,
  height,
  depth,
  color,
  opacity,
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth), 22), [width, height, depth]);
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
      }),
    [color, opacity]
  );

  React.useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      renderOrder={FRONT_REVEAL_RENDER_ORDER}
      frustumCulled={false}
    />
  );
}

function CabinetFloorShadow({
  position,
  rotationY,
  width,
  depth,
}: {
  position: [number, number, number];
  rotationY: number;
  width: number;
  depth: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
    gradient.addColorStop(0, "rgba(28,31,35,0.22)");
    gradient.addColorStop(0.52, "rgba(28,31,35,0.11)");
    gradient.addColorStop(1, "rgba(28,31,35,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shadowTexture = new THREE.CanvasTexture(canvas);
    shadowTexture.colorSpace = THREE.SRGBColorSpace;
    shadowTexture.minFilter = THREE.LinearFilter;
    shadowTexture.magFilter = THREE.LinearFilter;
    shadowTexture.generateMipmaps = false;
    return shadowTexture;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        depthTest: true,
      }),
    [texture]
  );

  React.useEffect(() => {
    return () => {
      texture.dispose();
      material.dispose();
    };
  }, [material, texture]);

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, rotationY]}
      renderOrder={-1}
      frustumCulled={false}
    >
      <planeGeometry args={[Math.max(width * 0.96, 0.28), Math.max(depth * 0.82, 0.34)]} />
      <primitive object={material} />
    </mesh>
  );
}

function CabinetSelectionTarget({
  position,
  rotationY,
  width,
  height,
  depth,
  selected,
  onSelect,
  onMoveSelected,
  onRemoveSelected,
}: {
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  depth: number;
  selected: boolean;
  onSelect?: () => void;
  onMoveSelected?: (dir: -1 | 1) => void;
  onRemoveSelected?: () => void;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
        visible={false}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {selected && (
        <CabinetBoxEdgeLines
          width={width + 1.2 * CM}
          height={height + 1.2 * CM}
          depth={depth + 1.2 * CM}
          color="#111827"
          opacity={0.55}
        />
      )}
      {selected && (
        <SelectedCabinetViewportControls
          width={width}
          height={height}
          depth={depth}
          onMove={onMoveSelected}
          onRemove={onRemoveSelected}
        />
      )}
    </group>
  );
}

function SelectedCabinetViewportControls({
  width,
  height,
  depth,
  onMove,
  onRemove,
}: {
  width: number;
  height: number;
  depth: number;
  onMove?: (dir: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const dragLastX = React.useRef<number | null>(null);
  const dragButtonRef = React.useRef<HTMLButtonElement | null>(null);

  function stopDomEvent(event: React.SyntheticEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  function handleDragPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    stopDomEvent(event);
    dragLastX.current = event.clientX;
    dragButtonRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    stopDomEvent(event);
    if (dragLastX.current === null) return;
    const threshold = 18;
    const delta = event.clientX - dragLastX.current;
    if (Math.abs(delta) < threshold) return;

    const steps = Math.trunc(delta / threshold);
    const dir: -1 | 1 = steps < 0 ? -1 : 1;
    for (let i = 0; i < Math.abs(steps); i += 1) {
      onMove?.(dir);
    }
    dragLastX.current += steps * threshold;
  }

  function clearDrag(event?: React.PointerEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    event?.preventDefault();
    if (event && dragButtonRef.current?.hasPointerCapture(event.pointerId)) {
      dragButtonRef.current.releasePointerCapture(event.pointerId);
    }
    dragLastX.current = null;
    dragButtonRef.current = null;
  }

  return (
    <>
      <Html
        position={[0, 0, depth / 2 + 0.08]}
        center
        zIndexRange={[100, 0]}
      >
        <button
          type="button"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={clearDrag}
          onPointerCancel={clearDrag}
          className="w-10 h-10 rounded-full bg-gray-900 text-white text-base font-semibold leading-none flex items-center justify-center cursor-ew-resize select-none shadow-lg border border-gray-900"
          title="Trage stanga/dreapta pentru mutare"
          aria-label="Muta dulapul stanga sau dreapta"
        >
          ↔
        </button>
      </Html>
      <Html
        position={[width / 2 + 0.16, height / 2 + 0.16, depth / 2 + 0.08]}
        center
        zIndexRange={[100, 0]}
      >
        <button
          type="button"
          onClick={(event) => {
            stopDomEvent(event);
            onRemove?.();
          }}
          className="h-8 px-2.5 rounded-full bg-white/95 text-red-500 text-[11px] font-semibold leading-none flex items-center justify-center border border-red-100 shadow-lg hover:bg-red-50"
          title="Sterge dulap"
          aria-label="Sterge dulap"
        >
          Sterge
        </button>
      </Html>
    </>
  );
}

function ViewportAddButton({
  position,
  onAdd,
}: {
  position: [number, number, number];
  onAdd: () => void;
}) {
  return (
    <Html position={position} center zIndexRange={[100, 0]}>
      <button
        type="button"
        onPointerDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onAdd();
        }}
        className="w-9 h-9 rounded-full bg-white/95 text-gray-900 text-2xl leading-none flex items-center justify-center border border-gray-200 shadow-lg hover:bg-gray-900 hover:text-white"
        title="Adauga dulap"
        aria-label="Adauga dulap"
      >
        +
      </button>
    </Html>
  );
}

function CabinetMesh({
  cabinet,
  colorway,
  wallA,
  collection,
  cornerSide = "right",
  editMode = false,
  selected = false,
  onSelect,
  onMoveSelected,
  onRemoveSelected,
}: {
  cabinet: Cabinet;
  colorway: Colorway;
  wallA: number;
  collection: DesignCollectionId;
  cornerSide?: string;
  editMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onMoveSelected?: (dir: -1 | 1) => void;
  onRemoveSelected?: () => void;
}) {
  const { width, height, depth, xPos, type } = cabinet;
  const isWallCab = ["wall", "wall-corner", "wall-hood"].includes(type);
  const isTall = ["tall", "tall-oven", "tall-fridge"].includes(type);
  const isCorner = type === "base-corner" || type === "wall-corner";

  let posX: number;
  let posZ: number;
  let rotY: number;

  if (cabinet.wall === "B") {
    if (isCorner) {
      const cornerOffset = isWallCab ? 0 : RULES.CORNER_BASE_OFFSET * CM;
      posX = cornerOffset + (width * CM) / 2;
      posZ = isWallCab ? WALL_Z : BASE_Z;
      rotY = 0;
    } else {
      posX = isWallCab ? WALL_Z : BASE_Z;
      posZ = xPos * CM + (width * CM) / 2;
      rotY = Math.PI / 2;
    }
  } else if (cabinet.wall === "C") {
    if (isCorner) {
      const cornerOffset = isWallCab ? 0 : RULES.CORNER_BASE_OFFSET * CM;
      posX = wallA * CM - cornerOffset - (width * CM) / 2;
      posZ = isWallCab ? WALL_Z : BASE_Z;
      rotY = 0;
    } else {
      posX = wallA * CM - (isWallCab ? WALL_Z : BASE_Z);
      posZ = xPos * CM + (width * CM) / 2;
      rotY = -Math.PI / 2;
    }
  } else if (cabinet.wall === "I") {
    posX = xPos * CM + (width * CM) / 2;
    posZ = (cabinet.zPos ?? 140) * CM;
    rotY = 0;
  } else if (cabinet.wall === "P") {
    const side = cabinet.runSide ?? "right";
    if (isCorner) {
      const cornerOffset = isWallCab ? 0 : RULES.CORNER_BASE_OFFSET * CM;
      posX = side === "left"
        ? cornerOffset + (width * CM) / 2
        : wallA * CM - cornerOffset - (width * CM) / 2;
      posZ = isWallCab ? WALL_Z : BASE_Z;
      rotY = 0;
    } else {
      posX = side === "left" ? BASE_Z : wallA * CM - BASE_Z;
      posZ = xPos * CM + (width * CM) / 2;
      rotY = side === "left" ? Math.PI / 2 : -Math.PI / 2;
    }
  } else {
    posX = xPos * CM + (width * CM) / 2;
    posZ = isWallCab ? WALL_Z : isTall ? (RULES.BASE_DEPTH / 2 + 2.5) * CM : BASE_Z;
    rotY = 0;
  }

  const posY = isWallCab
    ? (RULES.WALL_CAB_FROM_FLOOR + height / 2) * CM
    : (height / 2) * CM;

  const carcassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.carcassHex,
        roughness: 0.68,
        metalness: 0,
        envMapIntensity: 0.35,
        depthWrite: true,
        depthTest: true,
        transparent: false,
      }),
    [colorway.carcassHex]
  );

  const doorMat = useMemo(
    () => createDoorMaterial(colorway),
    [colorway]
  );

  const handleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.handleHex,
        roughness: colorway.handle === "inox" ? 0.28 : 0.46,
        metalness: colorway.handle === "inox" ? 0.32 : 0.08,
        envMapIntensity: 0.55,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        side: THREE.DoubleSide,
      }),
    [colorway.handleHex, colorway.handle]
  );
  const plinthMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1C1C1A",
        roughness: 0.85,
        metalness: 0.05,
        envMapIntensity: 0.25,
        depthWrite: true,
        depthTest: true,
        transparent: false,
      }),
    []
  );

  const W = width * CM;
  const H = height * CM;
  const D = depth * CM;
  const T = 1.8 * CM;
  const PLINTH_H = isWallCab || isTall ? 0 : 10 * CM;
  const DOOR_GAP = 0.15 * CM;
  const REVEAL = 0.4 * CM;
  const numDoors = width >= 70 ? 2 : 1;
  const hasDoors = type !== "base-dishwasher";
  const doorH = H - T * 2 - PLINTH_H - DOOR_GAP;
  const doorW = numDoors === 2 ? (W - T * 2 - DOOR_GAP) / 2 : W - T * 2 - DOOR_GAP;
  const handleY = isWallCab
    ? -(H / 2) + T + doorH * 0.15
    : isTall
    ? H / 2 - T - doorH * 0.08
    : -(H / 2) + PLINTH_H + T + doorH * 0.2;

  const edgeMat = new THREE.MeshStandardMaterial({
    color: "#D0CBC0",
    roughness: 0.9,
    envMapIntensity: 0.2,
    depthWrite: true,
    depthTest: true,
    transparent: false,
  });
  const revealLineColor = colorway.finish === "lucios" ? "#5f6874" : "#4b5563";
  const revealLineOpacity = colorway.finish === "lucios" ? 0.2 : 0.24;
  const carcassLineColor = "#6b7280";
  const carcassLineOpacity = 0.14;
  const showFloorShadow = !isWallCab;
  const isSideRunBaseCorner =
    type === "base-corner" && (cabinet.wall === "B" || cabinet.wall === "C");
  const sideCornerOffset = RULES.CORNER_BASE_OFFSET * CM;
  const selectionPosition: [number, number, number] =
    isSideRunBaseCorner && cabinet.wall === "B"
      ? [sideCornerOffset + D / 2, posY, sideCornerOffset + W / 2]
      : isSideRunBaseCorner && cabinet.wall === "C"
      ? [wallA * CM - sideCornerOffset - D / 2, posY, sideCornerOffset + W / 2]
      : [posX, posY, posZ];
  const selectionRotationY = isSideRunBaseCorner
    ? cabinet.wall === "B"
      ? Math.PI / 2
      : -Math.PI / 2
    : rotY;
  const floorShadowPosition: [number, number, number] = [
    selectionPosition[0],
    0.018,
    selectionPosition[2],
  ];

  const selectionOverlay = editMode ? (
    <CabinetSelectionTarget
      position={selectionPosition}
      rotationY={selectionRotationY}
      width={W}
      height={H}
      depth={D}
      selected={selected}
      onSelect={onSelect}
      onMoveSelected={onMoveSelected}
      onRemoveSelected={onRemoveSelected}
    />
  ) : null;
  const BROKEN_SKUS: string[] = [];

  const hasModel =
    MODEL_SKUS.includes(cabinet.baseSku ?? stripCollectionSku(cabinet.sku)) &&
    !BROKEN_SKUS.includes(cabinet.baseSku ?? stripCollectionSku(cabinet.sku));

  if (hasModel) {
    const glbWidth = width * CM;
    const glbHeight = height * CM;
    const glbDepth = depth * CM;
    const dishwasherFrontOffset = 53 * CM + 3.0 * CM;

    let glbPosX = posX - glbWidth / 2;
    let glbPosY = posY - glbHeight / 2;
    let glbPosZ = posZ - glbDepth / 2;

    if (type === "base-dishwasher") {
      glbPosY += 10 * CM;
    }

    const WALL_OFFSET = isWallCab ? 0 * CM : 5.0 * CM;

    if (isCorner) {
      const off = type === "base-corner" ? RULES.CORNER_BASE_OFFSET * CM : 0;
      if (cabinet.wall === "B") {
        glbPosX = off;        // 5cm from Wall B
        glbPosZ = off;        // 5cm from Wall A
      } else if (cabinet.wall === "C") {
        glbPosX = wallA * CM - off;  // 5cm from Wall C
        glbPosZ = off;               // 5cm from Wall A
      } else if (cabinet.wall === "P") {
        const side = cabinet.runSide ?? "right";
        glbPosX = side === "left" ? off : wallA * CM - off;
        glbPosZ = off;
      }
    } else {
      if (cabinet.wall === "B") {
        glbPosX = type === "base-dishwasher" ? dishwasherFrontOffset : WALL_OFFSET;
        glbPosZ = xPos * CM + width * CM;
      } else if (cabinet.wall === "C") {
        glbPosX = wallA * CM - (type === "base-dishwasher" ? dishwasherFrontOffset : WALL_OFFSET);
        glbPosZ = xPos * CM;
      } else if (cabinet.wall === "A" && type === "base-dishwasher") {
        glbPosZ = dishwasherFrontOffset;
      } else if (cabinet.wall === "I") {
        glbPosX = xPos * CM;
        glbPosZ = (cabinet.zPos ?? 140) * CM - glbDepth / 2;
      } else if (cabinet.wall === "P") {
        const side = cabinet.runSide ?? "right";
        glbPosX = side === "left" ? WALL_OFFSET : wallA * CM - WALL_OFFSET;
        glbPosZ = side === "left" ? xPos * CM + width * CM : xPos * CM;
      }
    }

    const fallback = (
      <group position={[posX, posY, posZ]} rotation={[0, rotY, 0]}>
        <mesh castShadow receiveShadow material={carcassMat}>
          <boxGeometry args={[width * CM, height * CM, depth * CM]} />
        </mesh>
      </group>
    );

    return (
      <>
        {showFloorShadow && (
          <CabinetFloorShadow
            position={floorShadowPosition}
            rotationY={selectionRotationY}
            width={W}
            depth={D}
          />
        )}
        {selectionOverlay}
        <GLBErrorBoundary fallback={fallback}>
          <React.Suspense fallback={fallback}>
            <CabinetMeshGLB
              key={`${collection}-${cabinet.sku}-${cabinet.wall}-${cabinet.xPos}-${cabinet.doorDirection}`}
              cabinet={cabinet}
              colorway={colorway}
              collection={collection}
              posX={glbPosX}
              posY={glbPosY}
              posZ={glbPosZ}
              rotY={rotY}
              doorDirection={cabinet.doorDirection ?? "S"}
            />
          </React.Suspense>
        </GLBErrorBoundary>
      </>
    );
  }

  return (
    <>
      {showFloorShadow && (
        <CabinetFloorShadow
          position={floorShadowPosition}
          rotationY={selectionRotationY}
          width={W}
          depth={D}
        />
      )}

      {selectionOverlay}

      <group position={[posX, posY, posZ]} rotation={[0, rotY, 0]}>
      <CabinetBoxEdgeLines
        width={W}
        height={H}
        depth={D}
        color={carcassLineColor}
        opacity={carcassLineOpacity}
      />


      <mesh castShadow receiveShadow material={carcassMat} position={[0, 0, -D / 2 + T / 2]}>
        <boxGeometry args={[W, H, T]} />
      </mesh>

      <mesh castShadow receiveShadow material={carcassMat} position={[-W / 2 + T / 2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
      </mesh>

      <mesh castShadow receiveShadow material={carcassMat} position={[W / 2 - T / 2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
      </mesh>

      <mesh castShadow receiveShadow material={carcassMat} position={[0, H / 2 - T / 2, 0]}>
        <boxGeometry args={[W - T * 2, T, D]} />
      </mesh>

      <mesh
        castShadow
        receiveShadow
        material={carcassMat}
        position={[0, -H / 2 + PLINTH_H + T / 2, 0]}
      >
        <boxGeometry args={[W - T * 2, T, D]} />
      </mesh>

      {!isWallCab && !isTall && (
        <mesh receiveShadow material={edgeMat} position={[0, -H / 2 + PLINTH_H / 2, T]}>
          <boxGeometry args={[W - T * 2, PLINTH_H, D - T * 2]} />
        </mesh>
      )}

      {hasDoors && numDoors === 1 && (
        <group position={[0, -PLINTH_H / 2, D / 2 + T / 2]}>
          <mesh castShadow material={doorMat}>
            <boxGeometry args={[doorW, doorH, T]} />
          </mesh>

          <DoorRevealLines
            width={doorW}
            height={doorH}
            z={T / 2 + 0.08 * CM}
            color={revealLineColor}
            opacity={revealLineOpacity}
          />

          <mesh material={carcassMat} position={[0, 0, T / 2 + 0.05 * CM]}>
            <boxGeometry args={[doorW - REVEAL * 2, doorH - REVEAL * 2, 0.1 * CM]} />
          </mesh>

          <mesh
            material={handleMat}
            position={[
              cabinet.doorDirection === "D" ? -(doorW / 2 - 3.5 * CM) : doorW / 2 - 3.5 * CM,
              handleY -
                posY +
                (isWallCab ? (RULES.WALL_CAB_FROM_FLOOR + H / 2) * CM : (H / 2) * CM) -
                posY,
              HANDLE_FORWARD_OFFSET,
            ]}
            rotation={[0, 0, 0]}
            renderOrder={HANDLE_RENDER_ORDER}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.8 * CM, 12 * CM, 0.9 * CM]} />
          </mesh>
        </group>
      )}

      {hasDoors && numDoors === 2 && (
        <>
          <group position={[-(doorW / 2 + DOOR_GAP / 2), -PLINTH_H / 2, D / 2 + T / 2]}>
            <mesh castShadow material={doorMat}>
              <boxGeometry args={[doorW, doorH, T]} />
            </mesh>

            <DoorRevealLines
              width={doorW}
              height={doorH}
              z={T / 2 + 0.08 * CM}
              color={revealLineColor}
              opacity={revealLineOpacity}
            />

            <mesh material={carcassMat} position={[0, 0, T / 2 + 0.05 * CM]}>
              <boxGeometry args={[doorW - REVEAL * 2, doorH - REVEAL * 2, 0.1 * CM]} />
            </mesh>

            <mesh
              material={handleMat}
              position={[
                cabinet.doorDirection === "D" ? -(doorW / 2 - 3 * CM) : doorW / 2 - 3 * CM,
                handleY,
                HANDLE_FORWARD_OFFSET,
              ]}
              rotation={[0, 0, 0]}
              renderOrder={HANDLE_RENDER_ORDER}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.8 * CM, 12 * CM, 0.9 * CM]} />
            </mesh>
          </group>

          <group position={[doorW / 2 + DOOR_GAP / 2, -PLINTH_H / 2, D / 2 + T / 2]}>
            <mesh castShadow material={doorMat}>
              <boxGeometry args={[doorW, doorH, T]} />
            </mesh>

            <DoorRevealLines
              width={doorW}
              height={doorH}
              z={T / 2 + 0.08 * CM}
              color={revealLineColor}
              opacity={revealLineOpacity}
            />

            <mesh material={carcassMat} position={[0, 0, T / 2 + 0.05 * CM]}>
              <boxGeometry args={[doorW - REVEAL * 2, doorH - REVEAL * 2, 0.1 * CM]} />
            </mesh>

            <mesh
              material={handleMat}
              position={[
                cabinet.doorDirection === "D" ? doorW / 2 - 3 * CM : -(doorW / 2 - 3 * CM),
                handleY,
                HANDLE_FORWARD_OFFSET,
              ]}
              rotation={[0, 0, 0]}
              renderOrder={HANDLE_RENDER_ORDER}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.8 * CM, 12 * CM, 0.9 * CM]} />
            </mesh>
          </group>
        </>
      )}

      {type === "base-dishwasher" && (
        <mesh
          castShadow
          material={doorMat}
          position={[0, -PLINTH_H / 2 + 10 * CM, D / 2 + T / 2]}
        >
          <boxGeometry
            args={[
              W - T * 2 - DOOR_GAP,
              H - T * 2 - PLINTH_H - DOOR_GAP - 10 * CM,
              T,
            ]}
          />
        </mesh>
      )}
      </group>
    </>
  );
}

function WorktopMerged({
  cabinets,
  colorway,
  wallA,
}: {
  cabinets: Cabinet[];
  colorway: Colorway;
  wallA: number;
}) {
  const mat = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const texPath = colorway.worktop === "stejar"
      ? "/textures/worktop-stejar.jpg"
      : "/textures/worktop-piatra.jpg";
    const texture = loader.load(texPath);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: colorway.worktop === "stejar" ? "#d4b896" : "#7a7570",
      roughness: colorway.worktop === "stejar" ? 0.8 : 0.9,
      metalness: 0.0,
      envMapIntensity: colorway.worktop === "stejar" ? 0.25 : 0.45,
    });
  }, [colorway.worktop]);

  const wT = RULES.WORKTOP_THICKNESS * CM;
  const wD = RULES.WORKTOP_DEPTH * CM;
  const CORNER_EXT = RULES.CORNER_BASE_OFFSET * CM;
  const worktopLineColor = colorway.worktop === "stejar" ? "#6f5435" : "#3f4650";
  const worktopLineOpacity = colorway.worktop === "stejar" ? 0.2 : 0.26;

  return (
    <>
      {(["A", "B", "C", "I", "P"] as const).map((wall) => {
        const wallCabs = cabinets.filter((c) => c.wall === wall);
        if (wallCabs.length === 0) return null;

        const minX = Math.min(...wallCabs.map((c) => c.xPos));
        const maxX = Math.max(...wallCabs.map((c) => c.xPos + c.width));
        const totalWidth = (maxX - minX) * CM;
        const centerX = (minX + (maxX - minX) / 2) * CM;

        if (wall === "B") {
          return (
            <WorktopBlock
              key="wt-B"
              material={mat}
              position={[WORKTOP_Z, WORKTOP_Y + WORKTOP_VISUAL_RAISE, centerX - CORNER_EXT / 2]}
              size={[wD, wT, totalWidth + CORNER_EXT]}
              edgeColor={worktopLineColor}
              edgeOpacity={worktopLineOpacity}
            />
          );
        }

        if (wall === "C") {
          return (
            <WorktopBlock
              key="wt-C"
              material={mat}
              position={[wallA * CM - WORKTOP_Z, WORKTOP_Y + WORKTOP_VISUAL_RAISE, centerX - CORNER_EXT / 2]}
              size={[wD, wT, totalWidth + CORNER_EXT]}
              edgeColor={worktopLineColor}
              edgeOpacity={worktopLineOpacity}
            />
          );
        }

        if (wall === "I") {
          const centerZ = ((wallCabs[0]?.zPos ?? 140) * CM);
          return (
            <WorktopBlock
              key="wt-I"
              material={mat}
              position={[centerX, WORKTOP_Y + WORKTOP_VISUAL_RAISE, centerZ]}
              size={[totalWidth, wT, wD]}
              edgeColor={worktopLineColor}
              edgeOpacity={worktopLineOpacity}
            />
          );
        }

        if (wall === "P") {
          const side = wallCabs[0]?.runSide ?? "right";
          return (
            <WorktopBlock
              key="wt-P"
              material={mat}
              position={[side === "left" ? WORKTOP_Z : wallA * CM - WORKTOP_Z, WORKTOP_Y + WORKTOP_VISUAL_RAISE, centerX]}
              size={[wD, wT, totalWidth]}
              edgeColor={worktopLineColor}
              edgeOpacity={worktopLineOpacity}
            />
          );
        }

        return (
          <WorktopBlock
            key="wt-A"
            material={mat}
            position={[centerX, WORKTOP_Y + WORKTOP_VISUAL_RAISE, WORKTOP_Z]}
            size={[totalWidth, wT, wD]}
            edgeColor={worktopLineColor}
            edgeOpacity={worktopLineOpacity}
          />
        );
      })}
    </>
  );
}

function WorktopBlock({
  material,
  position,
  size,
  edgeColor,
  edgeOpacity,
}: {
  material: THREE.Material;
  position: [number, number, number];
  size: [number, number, number];
  edgeColor: string;
  edgeOpacity: number;
}) {
  return (
    <group position={position}>
      <mesh material={material} castShadow receiveShadow>
        <boxGeometry args={size} />
      </mesh>
      <CabinetBoxEdgeLines
        width={size[0]}
        height={size[1]}
        depth={size[2]}
        color={edgeColor}
        opacity={edgeOpacity}
      />
    </group>
  );
}

function RunKickerPlinths({
  cabinets,
  colorway,
  wallA,
  wallB,
  cornerSide,
}: {
  cabinets: Cabinet[];
  colorway: Colorway;
  wallA: number;
  wallB?: number;
  cornerSide: "left" | "right";
}) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.plinthHex ?? colorway.handleHex,
        roughness: (colorway.plinth ?? colorway.handle) === "inox" ? 0.32 : 0.52,
        metalness: (colorway.plinth ?? colorway.handle) === "inox" ? 0.28 : 0.06,
        envMapIntensity: 0.42,
      }),
    [colorway.handle, colorway.handleHex, colorway.plinth, colorway.plinthHex]
  );

  const plinthY = 5 * CM;
  const plinthHeight = 10 * CM;
  const plinthThickness = 0.5 * CM;
  const frontOffset = 54 * CM;
  const cornerClearance = 54 * CM;
  const lJoinOverlap = 5 * CM;
  const wallAJoinOverlap = 10 * CM;
  const cornerFillerShift = 10 * CM;
  const runCabinets = cabinets.filter(
    (cabinet) => !["wall", "wall-corner", "wall-hood"].includes(cabinet.type)
  );
  const hasLeftLRun = !!wallB && cornerSide === "right" && runCabinets.some((cabinet) => cabinet.wall === "B");
  const hasRightLRun = !!wallB && cornerSide === "left" && runCabinets.some((cabinet) => cabinet.wall === "C");
  const strips: Array<{
    key: string;
    position: [number, number, number];
    size: [number, number, number];
  }> = [];

  const wallACabinets = runCabinets.filter((cabinet) => cabinet.wall === "A");
  if (wallACabinets.length > 0) {
    let start = Math.min(...wallACabinets.map((cabinet) => cabinet.xPos)) * CM;
    let end = Math.max(...wallACabinets.map((cabinet) => cabinet.xPos + cabinet.width)) * CM;

    if (hasLeftLRun) start = Math.max(start, cornerClearance - wallAJoinOverlap);
    if (hasRightLRun) end = Math.min(end, wallA * CM - cornerClearance + wallAJoinOverlap);

    if (end > start) {
      strips.push({
        key: "plinth-A",
        position: [(start + end) / 2, plinthY, frontOffset],
        size: [end - start, plinthHeight, plinthThickness],
      });
    }
  }

  (["B", "C"] as const).forEach((wall) => {
    const wallCabinets = runCabinets.filter((cabinet) => cabinet.wall === wall);
    if (wallCabinets.length === 0) return;

    const start = Math.max(
      cornerClearance - lJoinOverlap,
      Math.min(...wallCabinets.map((cabinet) => cabinet.xPos)) * CM
    );
    const end = Math.max(...wallCabinets.map((cabinet) => cabinet.xPos + cabinet.width)) * CM;
    if (end <= start) return;

    strips.push({
      key: `plinth-${wall}`,
      position: [
        wall === "B" ? frontOffset : wallA * CM - frontOffset,
        plinthY,
        (start + end) / 2,
      ],
      size: [plinthThickness, plinthHeight, end - start],
    });
  });

  if (hasLeftLRun) {
    strips.push({
      key: "plinth-corner-B",
      position: [
        cornerClearance - wallAJoinOverlap / 2 + cornerFillerShift,
        plinthY,
        frontOffset,
      ],
      size: [wallAJoinOverlap, plinthHeight, plinthThickness],
    });
  }

  if (hasRightLRun) {
    strips.push({
      key: "plinth-corner-C",
      position: [
        wallA * CM - cornerClearance + wallAJoinOverlap / 2 - cornerFillerShift,
        plinthY,
        frontOffset,
      ],
      size: [wallAJoinOverlap, plinthHeight, plinthThickness],
    });
  }

  return (
    <>
      {strips.map((strip) => (
        <mesh
          key={strip.key}
          material={material}
          position={strip.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={strip.size} />
        </mesh>
      ))}
    </>
  );
}
