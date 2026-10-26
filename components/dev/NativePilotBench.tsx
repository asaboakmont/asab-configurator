"use client";
import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { Scene, Mesh } from 'three';
import { COLORWAYS } from '@/data/colorways';
import { applyCollectionToCabinet, getSkuByCode } from '@/data/skus';
import type { Cabinet } from '@/types/kitchen';
import type { NativeFrameSample } from '@/components/viewer/NativePerformanceProbe';
const KitchenScene = dynamic(() => import('@/components/viewer/KitchenScene'), { ssr: false });
const median = (values: number[]) => { const ordered = [...values].sort((a,b) => a-b); return ordered[Math.floor(ordered.length / 2)] ?? 0; };
function geometryIds(scene: Scene) {
  const ids: string[] = [];
  scene.traverse(object => {
    if (object.userData.asab?.asabType !== 'cabinet') return;
    object.traverse(child => { const mesh = child as Mesh; if (mesh.isMesh) ids.push(mesh.geometry.uuid); });
  });
  return ids.sort();
}
export default function NativePilotBench() {
  const [colorway, setColorway] = useState(COLORWAYS[0]);
  const [status, setStatus] = useState('Loading 16 cabinets');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [colours, setColours] = useState<Record<string, unknown> | null>(null);
  const [orbit, setOrbit] = useState(false);
  const [view, setView] = useState<'normal' | 'interior'>('normal');
  const [scene, setScene] = useState<Scene | null>(null);
  const [drainer, setDrainer] = useState(false);
  const sampling = useRef({ readyAt: 0, start: 0, lastStatus: 0, finished: false, samples: [] as NativeFrameSample[] });
  const searchParams = useSearchParams();
  const originals = searchParams.get('nativeGeometry') === 'original';
  const cabinets = useMemo(() => {
    const items: Cabinet[] = [];
    for (const wall of ['A', 'B'] as const) for (let i = 0; i < 4; i++) for (const layer of ['CI', 'CS']) {
      const definition = getSkuByCode(`ASAB-${layer}-1U-RAFT-W0600-JPN`)!;
      items.push(applyCollectionToCabinet({ ...definition, id: `${wall}-${layer}-${i}`, wall, xPos: (wall === 'A' ? 60 : 0) + i * 60,
        drainerSku: drainer && wall === 'A' && layer === 'CS' && i === 0 ? 'ASAB-ACC-SCURG-W0600-COM' : undefined }, 'japandi'));
    }
    return items;
  }, [drainer]);
  const onFrame = useCallback((sample: NativeFrameSample) => {
    const state = sampling.current; if (state.finished || !scene) return;
    const now = performance.now();
    if (!state.readyAt) {
      if (now - state.lastStatus < 500) return;
      state.lastStatus = now;
      let loaded = 0; scene.traverse(object => { if (object.userData.asab?.asabType === 'cabinet') loaded++; });
      if (loaded === 16) { state.readyAt = now; setStatus('Warming up for 3 seconds'); setOrbit(true); }
      return;
    }
    if (now - state.readyAt < 3000) return;
    if (!state.start) { state.start = now; setStatus('Measuring orbit for 20 seconds'); return; }
    state.samples.push(sample);
    if (now - state.start >= 20000) {
      state.finished = true; setOrbit(false); setStatus('Complete');
      const times = state.samples.map(s => s.dt).sort((a,b)=>a-b);
      setResult({ mode: originals ? 'original' : 'pilot', cabinets: 16, samples: times.length,
        seconds: +((now-state.start)/1000).toFixed(2), fps: +(times.length * 1000 / (now-state.start)).toFixed(2),
        medianFrameMs: +median(times).toFixed(2), p95FrameMs: +times[Math.floor(times.length*.95)].toFixed(2),
        medianDrawCalls: median(state.samples.map(s=>s.calls)), medianTriangles: median(state.samples.map(s=>s.triangles)),
        geometries: sample.geometries, canvas: { width: sample.width, height: sample.height }, dpr: window.devicePixelRatio });
    }
  }, [scene, originals]);
  function restart() {
    sampling.current = { readyAt: 0, start: 0, lastStatus: 0, finished: false, samples: [] };
    setResult(null); setOrbit(false); setStatus('Loading 16 cabinets');
  }
  async function colourTest(worktopOnly = false) {
    if (!scene) return;
    setColours({ status: 'Running 10 edits', worktopOnly });
    const before = geometryIds(scene), durations: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      setColorway(current => worktopOnly ? { ...current, worktopHex: i % 2 ? '#A67C52' : '#8C8880' } : { ...current, doorHex: i % 2 ? '#F2F0EC' : '#6F2A3C' });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      durations.push(performance.now() - start);
    }
    const after = geometryIds(scene);
    const old = new Set(before);
    setColours({ edits: 10, worktopOnly, geometryCount: after.length, newGeometries: after.filter(id => !old.has(id)).length,
      medianEditToTwoFramesMs: +median(durations).toFixed(2), worstEditToTwoFramesMs: +Math.max(...durations).toFixed(2) });
  }
  function toggleInterior() {
    if (!scene) return;
    const show = view === 'interior';
    scene.traverse(object => { if (['front','handle'].includes(object.userData.asab?.category)) object.visible = show; });
    setView(show ? 'normal' : 'interior');
  }
  return <main className="min-h-screen bg-stone-100 p-4 text-sm">
    <h1 className="text-xl font-semibold">Native geometry pilot — {originals ? 'Original CAD faces' : 'Merged pilot'}</h1>
    <p>16-cabinet L fixture · same geometry, camera motion, lighting and shadows · development only</p>
    <nav className="my-3 flex flex-wrap gap-3 underline"><a href="/dev/native-pilot?nativeGeometry=original">Original benchmark</a><a href="/dev/native-pilot">Merged benchmark</a><a href="/?tip=colt&p1=300&p2=240&step=viewer&colectie=japandi">Actual configurator</a></nav>
    <div className="relative h-[560px] max-w-[1000px] bg-white"><KitchenScene cabinets={cabinets} colorway={colorway} wallA={300} wallB={240} cornerSide="right" collection="japandi" onSceneReady={setScene} onPerformanceSample={onFrame} benchmarkOrbit={orbit} /></div>
    <p role="status" className="my-2 font-semibold">{status}</p>
    <pre data-testid="native-performance-result" className="whitespace-pre-wrap">{JSON.stringify(result,null,2)}</pre>
    <div className="my-3 flex flex-wrap gap-3"><button className="rounded border bg-white p-2" onClick={() => colourTest()}>Test 10 door colours</button><button className="rounded border bg-white p-2" onClick={() => colourTest(true)}>Test 10 worktop colours</button><button className="rounded border bg-white p-2" onClick={toggleInterior}>Toggle interior</button><button className="rounded border bg-white p-2" onClick={restart}>Rerun orbit benchmark</button><label><input type="checkbox" checked={drainer} onChange={e=>{ setDrainer(e.target.checked); restart(); }} /> Fit 600 mm drainer</label></div>
    <pre data-testid="native-colour-result">{JSON.stringify(colours,null,2)}</pre>
  </main>;
}
