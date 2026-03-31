"use client";
import React, { useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Cabinet, Colorway } from "@/types/kitchen";
import { RULES } from "@/lib/rules/resolver";

interface KitchenSceneProps {
  cabinets: Cabinet[];
  colorway: Colorway;
  wallA: number;
  wallB?: number;
  cornerSide?: "left" | "right";
}

const CM = 0.1;
const BASE_Z = (RULES.BASE_DEPTH / 2 + 5.0) * CM;
const WALL_Z = (RULES.WALL_DEPTH / 2 + 1.5) * CM;
const WORKTOP_Z = (RULES.WORKTOP_DEPTH / 2) * CM;
const WORKTOP_Y = (RULES.BASE_HEIGHT + RULES.WORKTOP_THICKNESS / 2) * CM;
const HANDLE_RENDER_ORDER = 50;
const HANDLE_FORWARD_OFFSET = 0.12 * CM;

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

export default function KitchenScene({
  cabinets,
  colorway,
  wallA,
  wallB,
  cornerSide = "right",
}: KitchenSceneProps) {
  const midX = (wallA * CM) / 2;

  return (
    <Canvas
      shadows
      camera={{ position: [midX, 4.5, 10.0], fov: 55, near: 0.1, far: 1000 }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        preserveDrawingBuffer: true,
      }}
    >
      <OrbitControls
        enablePan
        minPolarAngle={Math.PI / 10}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2}
        maxDistance={60}
        target={[midX, 1.2, 0.315]}
      />

      <ambientLight intensity={1.2} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 10, 5]} intensity={0.4} />
      <directionalLight position={[0, 10, -5]} intensity={0.4} />
      <pointLight position={[midX, 25 * CM, 2]} intensity={0.2} />

      <Room wallA={wallA} wallB={wallB} cornerSide={cornerSide} />

      {cabinets.map((cab, i) => (
        <CabinetMesh
          key={`${cab.sku}-${cab.wall}-${cab.xPos}-${cab.doorDirection}`}
          cabinet={cab}
          colorway={colorway}
          wallA={wallA}
          cornerSide={cornerSide}
        />
      ))}

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

      <Environment preset="apartment" background={false} />
    </Canvas>
  );
}

function Room({
  wallA,
  wallB,
  cornerSide,
}: {
  wallA: number;
  wallB?: number;
  cornerSide?: string;
}) {
  const roomW = (wallA + 200) * CM;
  const roomD = (wallB ? wallB + 200 : 400) * CM;
  const wallH = 260 * CM;
  const leftWallX = -0.5 * CM;
  const rightWallX = wallA * CM + 0.5 * CM;
  const { camera } = useThree();
  const [sideOpacity, setSideOpacity] = React.useState(0.5);
  const [backOpacity, setBackOpacity] = React.useState(0.6);

  useFrame(() => {
    const z = camera.position.z;
    const x = camera.position.x;
    const kitchenMidX = (wallA * CM) / 2;

    setBackOpacity(Math.max(0.0, Math.min(0.6, (z / 5) * 0.6)));

    const xDist = Math.abs(x - kitchenMidX) / (wallA * CM);
    setSideOpacity(Math.max(0.0, Math.min(0.5, (1 - xDist * 2) * 0.5)));
  });

  return (
    <group>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[roomW / 2 - 50 * CM, 0, roomD / 2 - 50 * CM]}
      >
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color="#C8A96E" roughness={0.75} metalness={0.02} />
      </mesh>

      <mesh receiveShadow position={[roomW / 2 - 50 * CM, wallH / 2, -0.5 * CM]}>
        <boxGeometry args={[roomW, wallH, 1 * CM]} />
        <meshStandardMaterial
          color="#F0EDE6"
          roughness={0.9}
          transparent
          opacity={backOpacity}
        />
      </mesh>

      <mesh receiveShadow position={[leftWallX, wallH / 2, roomD / 2 - 50 * CM]}>
        <boxGeometry args={[1 * CM, wallH, roomD]} />
        <meshStandardMaterial
          color="#E8E4DC"
          roughness={0.9}
          transparent
          opacity={sideOpacity}
        />
      </mesh>

      {cornerSide === "left" && wallB && (
        <mesh receiveShadow position={[rightWallX, wallH / 2, roomD / 2 - 50 * CM]}>
          <boxGeometry args={[1 * CM, wallH, roomD]} />
          <meshStandardMaterial
            color="#E8E4DC"
            roughness={0.9}
            transparent
            opacity={sideOpacity}
          />
        </mesh>
      )}
    </group>
  );
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
  posX,
  posY,
  posZ,
  rotY,
  doorDirection,
}: {
  cabinet: Cabinet;
  colorway: Colorway;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  doorDirection: "S" | "D";
}) {
  const { sku } = cabinet;

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
        roughness: 0.75,
        envMapIntensity: 0,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    [colorway.carcassHex]
  );

  const doorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.doorHex,
        roughness:
          colorway.finish === "lucios" ? 0.05 : colorway.finish === "furnir" ? 0.8 : 0.5,
        metalness: colorway.finish === "lucios" ? 0.15 : 0,
        envMapIntensity: colorway.finish === "lucios" ? 1.2 : 0,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    [colorway.doorHex, colorway.finish]
  );

  const handleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.handleHex,
        roughness: colorway.handle === "inox" ? 0.12 : 0.28,
        metalness: colorway.handle === "inox" ? 1.0 : 0.75,
        envMapIntensity: 2.0,
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

    fetch(`/models/${sku}.glb`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${sku}.glb`);
        return r.arrayBuffer();
      })
      .then((rawBuffer) => {
        const buffer = rawBuffer.slice(0) as ArrayBuffer;
        const loader = new GLTFLoader();

        loader.parse(
          buffer,
          `/models/`,
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
                position: [child.position.x, child.position.y, child.position.z],
                rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
                scale: [child.scale.x, child.scale.y, child.scale.z],
              });
            });

            setMeshes(found);
          },
          (err: any) => console.error(`Failed parse ${sku}:`, err)
        );
      })
      .catch((err: any) => console.error(`Failed fetch ${sku}:`, err));

    return () => {
      cancelled = true;
    };
  }, [sku]);

  const matMap: Record<string, THREE.Material> = {
    carcass: carcassMat,
    door: doorMat,
    handle: handleMat,
    plinth: plinthMat,
    oven: ovenMat,
    glass: glassMat,
  };

  if (meshes.length === 0) return null;

  const mirrorDoor = doorDirection === "D";
  const isCorner = cabinet.type === "base-corner" || cabinet.type === "wall-corner";
  const shouldFlattenChildRotations = !isCorner && cabinet.wall !== "A";

  const handleMeshes = meshes.filter(m => m.matName === "handle");
  console.log(`${cabinet.sku} handles:`, handleMeshes.map(m => m.position));

  return (
    <group position={[posX, posY, posZ]} rotation={[0, rotY, 0]}>
      {(() => {
        const nonDoorMeshes = meshes.filter((m) => !["door", "handle"].includes(m.matName));
        const doorMeshes = meshes.filter((m) => ["door", "handle"].includes(m.matName));

        return (
          <>
            {nonDoorMeshes.map((m, i) => (
              <mesh
                key={`c-${i}`}
                geometry={m.geometry}
                material={matMap[m.matName] ?? carcassMat}
                position={m.position}
                rotation={shouldFlattenChildRotations ? [0, 0, 0] : m.rotation}
                scale={[m.scale[0] * 10, m.scale[1] * 10, m.scale[2] * 10]}
                castShadow
                receiveShadow
                frustumCulled={false}
                renderOrder={m.matName === "handle" ? HANDLE_RENDER_ORDER : 0}
              />
            ))}

            {doorMeshes.map((m, i) => {
              const isHandle = m.matName === "handle";
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
                    position={m.position}
                    rotation={shouldFlattenChildRotations ? [0, 0, 0] : m.rotation}
                    scale={[m.scale[0] * 10, m.scale[1] * 10, m.scale[2] * 10]}
                    castShadow
                    receiveShadow
                    frustumCulled={false}
                    renderOrder={isHandle ? HANDLE_RENDER_ORDER : 1}
                  />
                </group>
              );
            })}
          </>
        );
      })()}
    </group>
  );
}

function CabinetMesh({
  cabinet,
  colorway,
  wallA,
  cornerSide = "right",
}: {
  cabinet: Cabinet;
  colorway: Colorway;
  wallA: number;
  cornerSide?: string;
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
  } else {
    posX = xPos * CM + (width * CM) / 2;
    posZ = isWallCab ? WALL_Z : BASE_Z;
    rotY = 0;
  }

  const posY = isWallCab
    ? (RULES.WALL_CAB_FROM_FLOOR + height / 2) * CM
    : (height / 2) * CM;

  const carcassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.carcassHex,
        roughness: 0.7,
        depthWrite: true,
        depthTest: true,
        transparent: false,
      }),
    [colorway.carcassHex]
  );

  const doorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.doorHex,
        roughness:
          colorway.finish === "lucios" ? 0.05 : colorway.finish === "furnir" ? 0.8 : 0.5,
        metalness: colorway.finish === "lucios" ? 0.15 : 0,
        envMapIntensity: colorway.finish === "lucios" ? 1.2 : 0,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        side: THREE.DoubleSide,
      }),
    [colorway.doorHex, colorway.finish]
  );

  const handleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.handleHex,
        roughness: colorway.handle === "inox" ? 0.12 : 0.28,
        metalness: colorway.handle === "inox" ? 1.0 : 0.75,
        envMapIntensity: 2.0,
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
    depthWrite: true,
    depthTest: true,
    transparent: false,
  });

  const BROKEN_SKUS: string[] = [];

  const hasModel =
    MODEL_SKUS.includes(cabinet.sku) &&
    !BROKEN_SKUS.includes(cabinet.sku);

  if (hasModel) {
    const glbWidth = width * CM;
    const glbHeight = height * CM;
    const glbDepth = depth * CM;

    let glbPosX = posX - glbWidth / 2;
    let glbPosY = posY - glbHeight / 2;
    let glbPosZ = posZ - glbDepth / 2;

    if (type === "base-dishwasher" && cabinet.wall === "A") {
      glbPosZ = 53 * CM;
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
      }
    } else {
      if (cabinet.wall === "B") {
        glbPosX = WALL_OFFSET;
        glbPosZ = xPos * CM + width * CM;
      } else if (cabinet.wall === "C") {
        glbPosX = wallA * CM - WALL_OFFSET;
        glbPosZ = xPos * CM;
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
      <GLBErrorBoundary fallback={fallback}>
        <React.Suspense fallback={fallback}>
          <CabinetMeshGLB
            key={`${cabinet.sku}-${cabinet.wall}-${cabinet.xPos}-${cabinet.doorDirection}`}
            cabinet={cabinet}
            colorway={colorway}
            posX={glbPosX}
            posY={glbPosY}
            posZ={glbPosZ}
            rotY={rotY}
            doorDirection={cabinet.doorDirection ?? "S"}
          />
        </React.Suspense>
      </GLBErrorBoundary>
    );
  }

  return (
    <group position={[posX, posY, posZ]} rotation={[0, rotY, 0]}>
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
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colorway.worktopHex,
        roughness: 0.25,
        metalness: 0.05,
      }),
    [colorway.worktopHex]
  );

  const wT = RULES.WORKTOP_THICKNESS * CM;
  const wD = RULES.WORKTOP_DEPTH * CM;
  const CORNER_EXT = RULES.CORNER_BASE_OFFSET * CM;
  const WT_RAISE = 0.05 * CM;

  return (
    <>
      {(["A", "B", "C"] as const).map((wall) => {
        const wallCabs = cabinets.filter((c) => c.wall === wall);
        if (wallCabs.length === 0) return null;

        const minX = Math.min(...wallCabs.map((c) => c.xPos));
        const maxX = Math.max(...wallCabs.map((c) => c.xPos + c.width));
        const totalWidth = (maxX - minX) * CM;
        const centerX = (minX + (maxX - minX) / 2) * CM;

        if (wall === "B") {
          return (
            <mesh
              key="wt-B"
              material={mat}
              castShadow
              position={[WORKTOP_Z, WORKTOP_Y + WT_RAISE, centerX - CORNER_EXT / 2]}
            >
              <boxGeometry args={[wD, wT, totalWidth + CORNER_EXT]} />
            </mesh>
          );
        }

        if (wall === "C") {
          return (
            <mesh
              key="wt-C"
              material={mat}
              castShadow
              position={[wallA * CM - WORKTOP_Z, WORKTOP_Y + WT_RAISE, centerX - CORNER_EXT / 2]}
            >
              <boxGeometry args={[wD, wT, totalWidth + CORNER_EXT]} />
            </mesh>
          );
        }

        return (
          <mesh key="wt-A" material={mat} castShadow position={[centerX, WORKTOP_Y, WORKTOP_Z]}>
            <boxGeometry args={[totalWidth, wT, wD]} />
          </mesh>
        );
      })}
    </>
  );
}