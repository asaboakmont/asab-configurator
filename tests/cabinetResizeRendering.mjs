import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const root = process.argv[2] ?? new URL('../', import.meta.url).pathname;
const require = createRequire(`${root}/package.json`);
const ts = require('typescript'), THREE = require('three'), ReactBase = require('react');
const { GLTFLoader } = await import(`${root}/node_modules/three/examples/jsm/loaders/GLTFLoader.js`);
const source = readFileSync(`${root}/components/viewer/KitchenScene.tsx`, 'utf8');
const ast = ts.createSourceFile('scene.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['CabinetMeshGLB', 'CabinetMesh', 'GLBErrorBoundary'];
const selected = ast.statements.filter(n => names.includes(n.name?.text)).map(n => n.getText(ast)).join('\n');
const data = readFileSync(`${root}/public/models/1010.glb`);
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
const meshes = [];
gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse(m => { if (m.isMesh) meshes.push({ geometry: m.geometry.clone().applyMatrix4(m.matrixWorld), matName: 'carcass', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] }); });
assert.ok(meshes.length);
let hook = 0, failed = false;
const React = { ...ReactBase, useEffect() {}, useState(initial) { const value = [failed ? 'Load failed' : '', 0, failed ? [] : meshes][hook++]; return [value, () => {}]; } };
const stub = () => null;
const deps = { React, THREE, useMemo: fn => fn(), CM: .1, RULES: { WALL_CAB_FROM_FLOOR: 146.9, BASE_DEPTH: 53, CORNER_BASE_OFFSET: 5 }, BASE_Z: 3.15, WALL_Z: 1.75, MODEL_SKUS: ['1010','1001-STG','1001-DR','2001-STG','2001-DR'], GLB_HANDLE_FORWARD_OFFSET: .14, HANDLE_RENDER_ORDER: 10,
  stripCollectionSku: sku => sku.replace(/-(jpn|grm|frc)$/, ''), getSkuByCode: () => ({width:60}), cabinetWidthScale: (a,b) => a/b,
  cabinetObjectName: () => 'cabinet', cabinetExportData: () => ({}), createDoorMaterial: () => new THREE.MeshStandardMaterial(),
  CabinetSelectionTarget: stub, ImportedCabinetModel: stub, CabinetFloorShadow: stub, MeshEdgeLines: stub, Html: stub,
  handleScaleCompensation: () => ({position:[0,0,0],scale:[1,1,1]}) };
const compiled = ts.transpileModule(selected + '\nreturn { CabinetMeshGLB, CabinetMesh, GLBErrorBoundary };', {compilerOptions: {jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS}}).outputText;
const {CabinetMeshGLB, CabinetMesh, GLBErrorBoundary} = new Function(...Object.keys(deps), compiled)(...Object.values(deps));
function nodes(element) { if (!element || typeof element !== 'object') return []; return [element, ...ReactBase.Children.toArray(element.props?.children).flatMap(nodes)]; }
const colorway = {finish:'mat', handle:'inox', doorHex:'#fff', carcassHex:'#fff', handleHex:'#aaa'};
const cabinet = {id:'stable', baseSku:'1010', sku:'1010-jpn', type:'base', width:60, standardWidth:60, height:86, depth:53, wall:'A', xPos:0};
let modelKey;
for (const width of [60,75,45,60]) {
  const c = {...cabinet, width, xPos:width === 75 ? 20 : 0, wall:width === 45 ? 'B' : 'A', doorDirection:width === 75 ? 'D' : 'S'};
  const parent = CabinetMesh({cabinet:c, colorway, wallA:300, collection:'japandi'});
  const model = nodes(parent).find(n => n.type === CabinetMeshGLB);
  assert.ok(model, 'resized cabinet must retain real GLB renderer');
  modelKey ??= model.key; assert.equal(model.key, modelKey, 'resizing/moving/mirroring must not remount GLB');
  hook=0;
  const tree = CabinetMeshGLB(model.props);
  assert.equal(tree.props.scale[0], width/60);
  const drawn = nodes(tree).filter(n => n.type === 'mesh');
  assert.equal(drawn.length, meshes.length);
  assert.ok(drawn.every((n,i) => n.props.geometry === meshes[i].geometry), 'must render original loaded GLB geometry');
  assert.ok(!nodes(tree).some(n => n.type === 'boxGeometry'), 'healthy resize must never generate a box');
}
for (const type of ['base-corner', 'wall-corner']) for (const wall of ['B','C']) {
  const base = type === 'base-corner', width = base ? 95 : 100, off = base ? .5 : 0;
  const sku = `${base ? '1001' : '2001'}-${wall === 'B' ? 'STG' : 'DR'}`;
  const tree = CabinetMesh({cabinet:{...cabinet,type,wall,width,sku,baseSku:sku},colorway,wallA:400,collection:'japandi'});
  const model = nodes(tree).find(n => n.type === CabinetMeshGLB);
  assert.equal(model.props.rotY, wall === 'B' ? Math.PI/2 : -Math.PI/2);
  assert.equal(model.props.posX, wall === 'B' ? off : 40-off);
  assert.equal(model.props.posZ, wall === 'B' ? off+width*.1 : off);
}
failed=true; hook=0;
assert.ok(nodes(CabinetMeshGLB({cabinet,colorway,collection:'japandi',posX:0,posY:0,posZ:0,rotY:0,doorDirection:'S'})).some(n => n.props?.role === 'alert'));
assert.deepEqual(GLBErrorBoundary.getDerivedStateFromProps({resetKey:'75'}, {hasError:true, resetKey:'60'}), {hasError:false,resetKey:'75'});
assert.equal(GLBErrorBoundary.getDerivedStateFromProps({resetKey:'60'}, {hasError:false,resetKey:'60'}),null);
const viewer = readFileSync(`${root}/components/viewer/StepViewer.tsx`, 'utf8');
assert.ok(viewer.includes('key="kitchen-scene"'));
assert.ok(!viewer.includes('visibleCabinets.reduce((s,c) => s + c.width, 0)'));
console.log('PASS: real GLB mesh rendering through resize/reset, stable model identity across width/position/wall/door edits, visible load errors and boundary recovery');
