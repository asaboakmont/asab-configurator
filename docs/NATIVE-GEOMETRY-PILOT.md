# Native cabinet geometry pilot — 26 October 2026

The pilot is limited to Japandi 600 mm one-door base and wall cabinets:
`ASAB-CI-1U-RAFT-W0600-JPN` and `ASAB-CS-1U-RAFT-W0600-JPN`.
The original assets and the other 333 catalogue GLBs are unchanged.

## Browser measurements

A controlled 16-cabinet L fixture repeats the two pilot SKUs eight times each. This isolates the merge from differences between cabinet types. It uses the actual KitchenScene, the same programmed camera orbit, existing lighting/shadows and a 1696 × 1120 render canvas at DPR 2. Each run warms up for three seconds after all cabinets load, then samples for 20 seconds. These are desktop-browser results, not physical-phone measurements. The colour-update fix is present in both geometry runs.

| Metric | Original CAD faces | Merged pilot |
|---|---:|---:|
| Orbit FPS | 4.62 | 60 |
| Median frame time | 207.2 ms | 16.7 ms |
| 95th-percentile frame time | 290.8 ms | 17.5 ms |
| Median draw calls | 34,702 | 206 |
| Rendered triangles | 537,132 | 537,132 |

Draw calls fell 99.41%, with identical triangle counts. A separate run with one fitted 600 mm drainer measured 57.15 FPS and 724,592 triangles. No quality, shadow or lighting reductions were used.

Ten door-colour edits created 0 new geometries; the median edit-to-two-rendered-frames time was 33.4 ms. Ten worktop-colour edits also created 0 new cabinet geometries, with a 33.3 ms median. These timings include waiting for two animation frames, rather than measuring just a material assignment.

## Implementation and checks

- Merge CAD face primitives per original part and material. Preserve every vertex, triangle, normal, node transform, pivot and material assignment; no decimation or welding.
- Base model: 2,986 → 15 primitives; 2.86 → 1.74 MB. Wall model: 1,350 → 9 primitives; 1.29 → 0.78 MB.
- Keep fronts, carcasses, handles, legs and hardware separate so technical interiors and width edits retain their semantics.
- Build geometry only when the model, width, depth, handing or accessory changes. Material updates run separately; worktop changes do not enter the cabinet material effect.
- Read the latest finish when an asynchronous model load completes, so an in-flight download cannot restore an old colour.
- Unit checks compare every world-space triangle before/after merging and the rendered geometry at standard width; test custom widths, handedness, handle size, drainer placement/shelf removal and unchanged geometry UUIDs, positions and normals after colour edits.
- Existing catalogue/pricing/PDF checks remain applicable. No SKU, price or cabinet-dimension changes are made by this pilot.

## Reproducing

Run the local development server, then open `/dev/native-pilot?nativeGeometry=original` and `/dev/native-pilot` in turn. Keep the viewport the same and avoid running both WebGL scenes concurrently. The page is unavailable outside development. Use the colour buttons after the orbit run completes; the drainer checkbox reruns the benchmark. Interior visibility is a development-only inspection control.

Historical pilot result: the two pilot assets remain in `/models/catalogue-pilot/japandi/`. The actual configurator now uses the full optimized range; see [full-range optimization](NATIVE-FULL-OPTIMIZATION.md). `?nativeGeometry=original` is a development-only comparison switch.

To regenerate the pilot files, use Python 3 with NumPy:

```sh
python3 scripts/mergeNativePilot.py --repo . --output public/models/catalogue-pilot/japandi
node tests/nativeGeometryPilot.mjs
```

The merge script deliberately accepts only the two pilot SKUs. The separate `mergeNativeCatalogue.py` script now applies the validated merge to all 335 entries.
