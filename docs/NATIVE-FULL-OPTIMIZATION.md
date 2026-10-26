# Full-range native geometry optimization

All 335 entries use lossless per-part/material primitive merging: 82 cabinets in each of Smart, Japandi, Germain and Franc, six drainers and the hanging rail. No triangle decimation, vertex welding, pivot changes, SKU changes or repricing.

- Original GLB total: 866,714,500 bytes; optimized total: 544,458,476 bytes (37.2% smaller).
- Primitive total: 866,198 → 4,967 (99.43% fewer).
- All 14,972,248 triangles retained. Every indexed attribute is compared exactly against its source by the generator. Nodes, scenes, transforms and materials are unchanged.
- Original assets stay untouched under `public/models/catalogue/`. The runtime maps URLs to `public/models/catalogue-optimized/`; the registry keeps original export provenance.
- Source GLTF scenes are cached by URL. Cabinet geometry rebuilds only for model/dimension/handing/accessory changes; colour edits update materials only.

## Reproduce

```sh
python3 scripts/mergeNativeCatalogue.py --repo . --output public/models/catalogue-optimized
node tests/nativeFullRange.mjs
node tests/nativeCatalogue.mjs
node tests/nativeGeometryPilot.mjs
```

The Python generator requires NumPy. `optimization-report.json` records source/output SHA-256, bytes, triangles and primitive counts for each SKU. The full-range test parses/builds every optimized model with Three.js, checks those hashes, dimensions and semantic parts, and verifies material edits preserve geometry.

In development, append `nativePerf=1` to a normal configurator URL for a 20-second orbit benchmark after loading/warmup. The overlay reports FPS, frame times, draw calls, triangles and geometry creation after colour edits. Measurements sample after the viewport render to avoid reading contact-shadow blur statistics. Avoid concurrent scenes or rendering exports while measuring. `nativeGeometry=original` is the development-only original-asset comparison. Neither control changes production behavior.

## Source adaptations

The four source `ASAB-CS-HOTA-W0600-{SMT,JPN,GRM,FRC}` GLBs contain only carcass nodes and no door/front node. The runtime now supplies the matching collection’s 600 mm wall front and hardware, fitted to the 660 mm hood. Optimization and original exports remain intact. Wall corners temporarily use the previous GLBs pending manual retouching; their old 600 mm layout clearance is restored. Dishwasher/fridge legacy fallbacks and the four unpriced oven-drawer variants remain as documented in the catalogue.
