# FreeWop cabinet catalogue

The configurator uses individual optimized GLBs from `public/models/catalogue-optimized/<collection>/` on demand. Original exports remain intact in `public/models/catalogue/<collection>/` for provenance and development comparison. See [full-range optimization](NATIVE-FULL-OPTIMIZATION.md). It does not load the 880 MB combined review file. All 335 source files were SHA-256 verified against the completed FreeWop export of 26 October 2026.

- 82 model variants per collection: Smart, Japandi, Germain and Franc.
- Six exact-width drainers and one shared ASB-SINA hanging rail.
- 324 saleable cabinet variants; four oven drawer variants are unavailable until separately priced. Assets for the unavailable variants are retained, but the picker and price resolver reject them.
- Smart uses the approved Soho prices and the SMT SKU suffix. Oven door assets use the price-list CPT-US price under their distinct CPT-USA model SKU.
- `data/revisedCatalogue.ts` remains the authoritative VAT-inclusive price table. `data/nativeCatalogue.json` records asset metadata/export provenance; regenerate its TypeScript counterpart with `node scripts/syncNativeCatalogue.mjs` after changing asset metadata. Prices in the manifest are historical; the runtime reads the approved price table.
- The Germain 1000 mm two-front lift price of 415 RON retains its confirmation note.

## Geometry and placement

Native assets are metres, Y-up, front +Z, carcass-bottom pivot. Base and tall units have 100 mm legs below that pivot. The renderer converts metres to scene units and scales only X for custom widths. It does not fit legs or handles into the carcass bounding box. Discrete handles retain their size; Germain edge profiles follow the cabinet width. New base models retain wall-facing placement. Wall corners temporarily use the previous 2001-STG/DR GLBs and reserve their previous 600 mm layout clearance, pending manual retouching of the new models.

Mesh categories preserve fronts, carcasses, handles, legs and hardware for PDF interiors, wireframes, HD renders and GLB export. Doorless views hide fronts/handles while keeping hardware and accessories. Exports wait for real meshes to finish loading.

## Drainers

Use “Scurgatoare incorporate” in the viewer. Supported nominal widths: 400, 500, 600, 700, 800 and 900 mm, in ordinary 700 mm wall cabinets only (`CS-1U-RAFT` / `CS-2U-RAFT`). No stretching or nearest-size substitution. Hood, corner, overhead, tall and base cabinets are excluded.

The real drainer mesh sits between 18 mm sides, behind the fronts and above the bottom panel. Installing it removes the shelf. Its SKU persists on the cabinet; its approved price is included once in the cabinet total and documented in the PDF note. Collection switching preserves compatible drainers. Resizing to an unsupported width removes the accessory and its charge.

The 2000 mm ASB-SINA rail is available in the internal catalogue under Accesorii at 40 RON, mounted behind the suspended run. It is not charged automatically. Dishwasher fronts and integrated fridge units have no equivalent in this export and retain their previous model/pricing fallback with an explicit legacy-price note.

## Validation

`node tests/nativeCatalogue.mjs` checks all 335 registrations/prices, SKU mapping, blocked variants, accessory compatibility and repricing, immutable real GLB geometry, legs, fronts, hardware and custom-width scaling. Existing revised-pricing/PDF, placement, GLB, HD rendering, dimensioned-plan and customer-portal checks also apply. Stop the development server before `npm run build`.

## Heights and wall alignment

Standard hanging cabinets finish at 2200 mm (700 mm units start at 1500 mm; 660 mm hoods start at 1540 mm). SP cabinets start at 2200 mm, including saved configurations with the old 2169 mm mounting value. CA tall cabinets sit against the wall on A, B and C; rear alignment includes actual back-panel thickness. Base units keep their service gap. The shared `cabinetPlacement.ts` helper supplies renderer and collision/editor elevations.

The source hood GLBs lack fronts. The viewer supplements each hood with its own collection’s 600 mm wall-cabinet front and hardware, adapting the front to the 660 mm body and keeping hardware rigid. Japandi remains push-to-open. Source files are unchanged, while PDF/HD/GLB exports receive the completed scene. `node tests/cabinetAlignment.mjs` validates these corrections.

Room height is editable in the dimensions step. A 400 mm SP mounted at 2200 mm requires a ceiling of at least 2600 mm; the editor rejects it in the default 2400 mm room.
