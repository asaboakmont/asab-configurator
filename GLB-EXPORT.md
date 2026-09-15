# Export GLB

The viewer's **Export GLB** button downloads the live R3F scene as a binary `ASAB-Kitchen-<timestamp>.glb`. It uses `lib/asab/exportGLB.ts`, independently callable with any Three.js scene via `exportKitchenGLB(scene)` (buffer and counts) or `downloadKitchenGLB(scene, projectName)` (download).

## Developer enablement

The export UI is enabled for authenticated `admin` and `designer` sessions, and export rechecks the server session before downloading. No public feature flag is required. Credentials and the signed-session secret come from `ASAB_ADMIN_PASSWORD`, `ASAB_DESIGNER_PASSWORD`, and `ASAB_INTERNAL_SESSION_SECRET`. Set strong values in deployment. Internal users can generate/save configurations and export documents without customer contact popups; customer email and phone requirements remain unchanged.

## Custom cabinets

Cabinets retain their catalog `standardWidth` and SKU while `width` records the final manufactured dimension. Custom widths are rendered with the existing procedural cabinet geometry so panel thickness stays fixed and width-spanning carcass/front parts are rebuilt to the requested size. Imported cabinet GLBs do not expose dependable semantic part names—the carcass is commonly one combined mesh—so custom cabinets intentionally use the parametric fallback rather than stretching detailed hardware and panels. Corner cabinets remain fixed-size in V1.

Free-placement cabinets preserve their exact final scene transform in the GLB and include millimetre position and rotation metadata. They use the same parametric geometry fallback as custom-width cabinets so rotation occurs around the cabinet centre. Corner cabinets remain wall-bound in V1. Wall worktops and plinths ignore detached free cabinets; automatic island grouping/worktops are reserved for a later grouped-cabinet implementation.

## Scene conventions

- Put `userData.exportGLB = true` on physical design roots. Descendants inherit inclusion; unrelated scene objects default to exclusion.
- Put `userData.excludeFromGLB = true` or `userData.exportGLB = false` on overlays/debug/selection objects. This excludes the complete subtree, even if a descendant opts in.
- Cameras, lights and Three.js helpers are always excluded.
- Store JSON metadata under `userData.asab`. Cabinet roots include cabinet ID, SKU/type, category, dimensions in centimetres, placement, price, collection, door customization and color/material information. Mesh descendants receive `parentCabinetId` automatically.
- Existing cabinet IDs are preferred. Legacy cabinets without IDs use a placement-based fallback; this fallback changes when placement changes.
- New obstruction kinds belong under a tagged physical root, like existing openings, obstructions and boilers. Mark clearance zones and service markers as excluded.
- `exportOpaque: true` restores camera-faded wall materials in the export copy. Other materials/textures are retained as supported by GLTFExporter.

## Coordinates and hierarchy

Ancestor groups and local matrices are preserved, including nonuniform scale, nested rotations and mirrored parts. No flattening or TRS decomposition is performed. The live scene is not edited or disposed. Cabinets remain separate nodes; shared worktops and run plinths remain separate design objects, without inventing a single parent cabinet.

The viewer uses **10 scene units per metre** (`CM = 0.1`). Export applies a uniform `0.1` conversion at the GLB root, so glTF and Blender receive real metre dimensions: a 300 cm wall imports as 3 m. This conversion changes only the exported hierarchy and never the live R3F scene. Root extras record the source scale and metre conversion. glTF Y-up coordinates use Blender's standard glTF import axis conversion.

Only geometry currently mounted in the live scene is exported, including loading/error fallback geometry if present. Export after models and textures have loaded for the complete detailed model. This does not generate appliances or wall cutouts absent from the scene, nor convert meshes into parametric Blender cabinets.

## Validation

Run `node tests/exportGLB.mjs` for actual binary export, metadata, nested world matrices, negative scale, exclusion, hidden wall restoration, subtree export and live-scene immutability checks. Run `npx tsc --noEmit --incremental false` for project type checking. The exporter imports the project's Three.js r167 `examples/jsm/exporters/GLTFExporter.js` dynamically in the browser. No dependency changes are required.

The download logs mesh and category counts to the console. Export failures appear beside the button; duplicate downloads are prevented while an export is running.
