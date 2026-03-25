"use client";
import type { Cabinet } from "@/types/kitchen";

interface FloorPlanProps {
  cabinets: Cabinet[];
  wallA:    number;
  wallB?:   number;
  layout:   "linear" | "l-shape";
}

const SCALE = 1.8;
const BASE_DEPTH = 53;
const WALL_DEPTH = 32;

const TYPE_COLORS: Record<string, { fill: string; label: string }> = {
  "base":            { fill: "#E8E0D0", label: "" },
  "base-sink":       { fill: "#B8D4E8", label: "S" },
  "base-hob":        { fill: "#F4C4A0", label: "H" },
  "base-oven":       { fill: "#F4C4A0", label: "O" },
  "base-drawer":     { fill: "#E8E0D0", label: "" },
  "base-dishwasher": { fill: "#C8E0C8", label: "MV" },
  "base-corner":     { fill: "#D4C8B0", label: "C" },
  "wall":            { fill: "#C8D8E8", label: "" },
  "wall-corner":     { fill: "#B0C4D8", label: "C" },
  "wall-hood":       { fill: "#E8D4B0", label: "HT" },
  "tall":            { fill: "#D0C8D8", label: "T" },
  "tall-oven":       { fill: "#D8C0B8", label: "TO" },
  "tall-fridge":     { fill: "#B8D0D8", label: "F" },
};

export default function FloorPlan({ cabinets, wallA, wallB, layout }: FloorPlanProps) {
  const W = wallA * SCALE;
  const H = (wallB ?? 100) * SCALE;

  const tallTypes = ["tall","tall-oven","tall-fridge"];
  const baseCabsA = cabinets.filter(c => c.wall === "A" && !["wall","wall-corner","wall-hood"].includes(c.type) && !tallTypes.includes(c.type));
  const tallCabsA = cabinets.filter(c => c.wall === "A" && tallTypes.includes(c.type));
  const wallCabsA = cabinets.filter(c => c.wall === "A" &&  ["wall","wall-corner","wall-hood"].includes(c.type));
  const baseCabsB = cabinets.filter(c => c.wall === "B" && !["wall","wall-corner","wall-hood"].includes(c.type));
  const wallCabsB = cabinets.filter(c => c.wall === "B" &&  ["wall","wall-corner","wall-hood"].includes(c.type));
  const baseCabsC = cabinets.filter(c => c.wall === "C" && !["wall","wall-corner","wall-hood"].includes(c.type));
  const wallCabsC = cabinets.filter(c => c.wall === "C" &&  ["wall","wall-corner","wall-hood"].includes(c.type));

  const hasWallB = baseCabsB.length > 0 || wallCabsB.length > 0;
  const hasWallC = baseCabsC.length > 0 || wallCabsC.length > 0;

  const ox = 40 + BASE_DEPTH * SCALE; // origin x — leave room for Wall B on left
  const oy = 40;

  const svgW = ox + W + BASE_DEPTH * SCALE + 40; // room for Wall C on right
  const svgH = layout === "l-shape"
    ? H + BASE_DEPTH * SCALE + 80
    : BASE_DEPTH * SCALE + 80;

  return (
    <div className="w-full overflow-x-auto -mx-2 px-2">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ maxWidth: "100%", height: "auto", display: "block" }}>

        {/* Back wall A */}
        <line x1={ox} y1={oy} x2={ox + W} y2={oy} stroke="#6B6560" strokeWidth={5} strokeLinecap="round"/>
        {/* Left wall B */}
        {hasWallB && layout === "l-shape" && (
          <line x1={ox} y1={oy} x2={ox} y2={oy + H} stroke="#6B6560" strokeWidth={5} strokeLinecap="round"/>
        )}
        {/* Right wall C */}
        {hasWallC && layout === "l-shape" && (
          <line x1={ox + W} y1={oy} x2={ox + W} y2={oy + H} stroke="#6B6560" strokeWidth={5} strokeLinecap="round"/>
        )}

        {/* Wall A dimension */}
        <text x={ox + W / 2} y={oy - 14} textAnchor="middle" fontSize={9} fill="#6B6560" fontFamily="sans-serif">
          Perete A: {wallA} cm
        </text>

        {/* Wall B/C dimension */}
        {layout === "l-shape" && wallB && (
          <text x={ox - 12} y={oy + H / 2} textAnchor="middle" fontSize={9} fill="#6B6560" fontFamily="sans-serif"
            transform={`rotate(-90,${ox - 12},${oy + H / 2})`}>
            {wallB} cm
          </text>
        )}

        {/* Base cabs Wall A */}
        {baseCabsA.map((cab, i) => {
          const x = ox + cab.xPos * SCALE;
          const y = oy;
          const w = cab.width * SCALE;
          const d = BASE_DEPTH * SCALE;
          const col = TYPE_COLORS[cab.type] ?? TYPE_COLORS["base"];
          return (
            <g key={`ba${i}`}>
              <rect x={x} y={y} width={w} height={d} fill={col.fill} stroke="#8C6A3F" strokeWidth={0.7} rx={1}/>
              <text x={x + w/2} y={y + d/2 - 3} textAnchor="middle" fontSize={7} fill="#3D3C3A" fontFamily="sans-serif">{cab.width}cm</text>
              {col.label && <text x={x + w/2} y={y + d/2 + 7} textAnchor="middle" fontSize={9} fill="#8C6A3F" fontFamily="sans-serif" fontWeight="bold">{col.label}</text>}
            </g>
          );
        })}

        {/* Tall cabs Wall A — full depth, distinct color */}
        {tallCabsA.map((cab, i) => {
          const x = ox + cab.xPos * SCALE;
          const y = oy;
          const w = cab.width * SCALE;
          const d = cab.depth * SCALE;
          const col = TYPE_COLORS[cab.type] ?? TYPE_COLORS["tall"];
          return (
            <g key={`ta${i}`}>
              <rect x={x} y={y} width={w} height={d} fill={col.fill} stroke="#6B5B8C" strokeWidth={1} rx={1}/>
              <text x={x + w/2} y={y + d/2 - 3} textAnchor="middle" fontSize={7} fill="#3D3C3A" fontFamily="sans-serif">{cab.width}cm</text>
              <text x={x + w/2} y={y + d/2 + 7} textAnchor="middle" fontSize={9} fill="#6B5B8C" fontFamily="sans-serif" fontWeight="bold">{col.label}</text>
            </g>
          );
        })}

        {/* Wall cabs Wall A — only where NO tall cab exists at same xPos */}
        {wallCabsA.filter(wc => !tallCabsA.some(tc => tc.xPos <= wc.xPos && tc.xPos + tc.width > wc.xPos)).map((cab, i) => {
          const x = ox + cab.xPos * SCALE;
          const y = oy - WALL_DEPTH * SCALE * 0.35;
          const w = cab.width * SCALE;
          const d = WALL_DEPTH * SCALE * 0.35;
          const col = TYPE_COLORS[cab.type] ?? TYPE_COLORS["wall"];
          return <rect key={`wa${i}`} x={x} y={y} width={w} height={d} fill={col.fill} stroke="#4A7A9B" strokeWidth={0.5} rx={1} opacity={0.8}/>;
        })}

        {/* Base cabs Wall B — left side */}
        {baseCabsB.map((cab, i) => {
          const x = ox - BASE_DEPTH * SCALE;
          const y = oy + cab.xPos * SCALE;
          const w = BASE_DEPTH * SCALE;
          const h = cab.width * SCALE;
          const col = TYPE_COLORS[cab.type] ?? TYPE_COLORS["base"];
          return (
            <g key={`bb${i}`}>
              <rect x={x} y={y} width={w} height={h} fill={col.fill} stroke="#8C6A3F" strokeWidth={0.7} rx={1}/>
              <text x={x + w/2} y={y + h/2 - 3} textAnchor="middle" fontSize={7} fill="#3D3C3A" fontFamily="sans-serif">{cab.width}cm</text>
              {col.label && <text x={x + w/2} y={y + h/2 + 7} textAnchor="middle" fontSize={9} fill="#8C6A3F" fontFamily="sans-serif" fontWeight="bold">{col.label}</text>}
            </g>
          );
        })}

        {/* Wall cabs Wall B — left side */}
        {wallCabsB.map((cab, i) => {
          const x = ox - BASE_DEPTH * SCALE - WALL_DEPTH * SCALE * 0.35;
          const y = oy + cab.xPos * SCALE;
          const w = WALL_DEPTH * SCALE * 0.35;
          const h = cab.width * SCALE;
          const col = TYPE_COLORS[cab.type] ?? TYPE_COLORS["wall"];
          return <rect key={`wb${i}`} x={x} y={y} width={w} height={h} fill={col.fill} stroke="#4A7A9B" strokeWidth={0.5} rx={1} opacity={0.8}/>;
        })}

        {/* Base cabs Wall C — right side */}
        {baseCabsC.map((cab, i) => {
          const x = ox + W;
          const y = oy + cab.xPos * SCALE;
          const w = BASE_DEPTH * SCALE;
          const h = cab.width * SCALE;
          const col = TYPE_COLORS[cab.type] ?? TYPE_COLORS["base"];
          return (
            <g key={`bc${i}`}>
              <rect x={x} y={y} width={w} height={h} fill={col.fill} stroke="#8C6A3F" strokeWidth={0.7} rx={1}/>
              <text x={x + w/2} y={y + h/2 - 3} textAnchor="middle" fontSize={7} fill="#3D3C3A" fontFamily="sans-serif">{cab.width}cm</text>
              {col.label && <text x={x + w/2} y={y + h/2 + 7} textAnchor="middle" fontSize={9} fill="#8C6A3F" fontFamily="sans-serif" fontWeight="bold">{col.label}</text>}
            </g>
          );
        })}

        {/* Wall cabs Wall C — right side */}
        {wallCabsC.map((cab, i) => {
          const x = ox + W + BASE_DEPTH * SCALE;
          const y = oy + cab.xPos * SCALE;
          const w = WALL_DEPTH * SCALE * 0.35;
          const h = cab.width * SCALE;
          const col = TYPE_COLORS[cab.type] ?? TYPE_COLORS["wall"];
          return <rect key={`wc${i}`} x={x} y={y} width={w} height={h} fill={col.fill} stroke="#4A7A9B" strokeWidth={0.5} rx={1} opacity={0.8}/>;
        })}

        {/* Legend */}
        <g transform={`translate(${ox}, ${oy + BASE_DEPTH * SCALE + (layout === "l-shape" && wallB ? H : 0) + 16})`}>
          {[
            { color: "#E8E0D0", label: "Baza" },
            { color: "#B8D4E8", label: "Chiuveta" },
            { color: "#F4C4A0", label: "Plita/Cuptor" },
            { color: "#B8D0D8", label: "Frigider" },
            { color: "#C8D8E8", label: "Suspendat" },
          ].map((item, i) => (
            <g key={i} transform={`translate(${i * 80}, 0)`}>
              <rect width={10} height={10} fill={item.color} stroke="#8C6A3F" strokeWidth={0.5} rx={1}/>
              <text x={13} y={9} fontSize={7} fill="#6B6560" fontFamily="sans-serif">{item.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
