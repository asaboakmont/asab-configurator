"use client";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Mesh } from 'three';
import type { Cabinet, Colorway, DesignCollectionId } from '@/types/kitchen';
import NativePerformanceProbe, { type NativeFrameSample } from './NativePerformanceProbe';
type Props = { cabinets: Cabinet[]; colorway: Colorway; controlsRef: MutableRefObject<any>; wallA: number; collection: DesignCollectionId };
export default function ConfiguratorPerformanceMonitor(props: Props) {
  const enabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('nativePerf') === '1';
  return enabled ? <EnabledMonitor {...props} /> : null;
}
function EnabledMonitor({ cabinets, colorway, controlsRef, wallA, collection }: Props) {
  const { scene } = useThree();
  const state = useRef({ ready: 0, start: 0, checked: 0, done: false, samples: [] as NativeFrameSample[], ids: new Set<string>() });
  const [status, setStatus] = useState('Loading');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [edits, setEdits] = useState({ changes: 0, newCabinetGeometries: 0 });
  const [orbit, setOrbit] = useState(false);
  const appearance = JSON.stringify(colorway), previousAppearance = useRef(appearance);
  const configuration = JSON.stringify(cabinets.map(c => [c.id, c.sku, c.width, c.depth, c.doorDirection, c.drainerSku, c.xPos, c.wall]));
  const previousConfiguration = useRef(configuration);
  useEffect(() => {
    if (configuration === previousConfiguration.current) return;
    previousConfiguration.current = configuration;
    state.current = { ready: 0, start: 0, checked: 0, done: false, samples: [], ids: new Set<string>() };
    setResult(null); setStatus('Loading'); setOrbit(false);
  }, [configuration]);
  const geometryIds = useCallback(() => {
    const ids = new Set<string>();
    scene.traverse(object => {
      if (object.userData.asab?.asabType !== 'cabinet') return;
      object.traverse(child => { const mesh = child as Mesh; if (mesh.isMesh) ids.add(mesh.geometry.uuid); });
    });
    return ids;
  }, [scene]);
  useEffect(() => {
    if (appearance === previousAppearance.current) return;
    previousAppearance.current = appearance;
    if (!state.current.ready) return;
    let cancelled = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return;
      const next = geometryIds(), added = Array.from(next).filter(id => !state.current.ids.has(id)).length;
      state.current.ids = next;
      setEdits(old => ({ changes: old.changes + 1, newCabinetGeometries: old.newCabinetGeometries + added }));
    }));
    return () => { cancelled = true; };
  }, [appearance, geometryIds]);
  const onSample = useCallback((sample: NativeFrameSample) => {
    const s = state.current; if (s.done) return;
    const now = performance.now();
    if (!s.ready) {
      if (now - s.checked < 500) return;
      s.checked = now;
      const loaded = new Set<string>();
      scene.traverse(object => {
        if (object.userData.asab?.asabType !== 'cabinet' || object.userData.excludeFromGLB) return;
        let real = false;
        object.traverse(child => { const mesh = child as Mesh; if (mesh.isMesh && !(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(m => 'wireframe' in m && m.wireframe)) real = true; });
        if (real) loaded.add(object.userData.asab.cabinetId);
      });
      const expected = cabinets.map(c => c.id ?? `${c.sku}-${c.wall}-${c.type}-${c.xPos}-${c.zPos ?? 0}`);
      if (expected.length && expected.every(id => loaded.has(id))) {
        s.ready = now; s.ids = geometryIds(); setStatus('Warming up'); setOrbit(true);
      }
      return;
    }
    if (now - s.ready < 3000) return;
    if (!s.start) { s.start = now; setStatus('Measuring 20 seconds'); return; }
    s.samples.push(sample);
    if (now - s.start < 20000) return;
    s.done = true; setOrbit(false); setStatus('Complete');
    const median = (values: number[]) => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const times = s.samples.map(v=>v.dt).sort((a,b)=>a-b);
    setResult({ collection, cabinets: cabinets.length, types: Array.from(new Set(cabinets.map(c=>c.type))), walls: Array.from(new Set(cabinets.map(c=>c.wall))),
      fps: +(s.samples.length*1000/(now-s.start)).toFixed(2), medianFrameMs: +median(times).toFixed(2), p95FrameMs: +times[Math.floor(times.length*.95)].toFixed(2),
      drawCalls: median(s.samples.map(v=>v.calls)), triangles: median(s.samples.map(v=>v.triangles)),
      canvas: { width: sample.width, height: sample.height }, geometries: sample.geometries, seconds: +((now-s.start)/1000).toFixed(2) });
  }, [scene, cabinets, geometryIds, collection]);
  return <>
    <NativePerformanceProbe onSample={onSample} orbit={orbit} controlsRef={controlsRef} wallA={wallA} rightReturn={cabinets.some(c=>c.wall==='C')} />
    <Html fullscreen style={{ pointerEvents: 'none' }}><pre data-testid="configurator-performance-result" style={{ position:'absolute', top:60, left:8, maxWidth:280, maxHeight:390, overflow:'auto', padding:8, background:'rgba(255,255,255,.92)', fontSize:10, whiteSpace:'pre-wrap' }}>{JSON.stringify({ status, ...result, colourEdits: edits },null,2)}</pre></Html>
  </>;
}
