# Export GLB

The viewer's **Export GLB** button downloads the live R3F scene as a binary `ASAB-Kitchen-<timestamp>.glb`. It uses `lib/asab/exportGLB.ts`, independently callable with any Three.js scene via `exportKitchenGLB(scene)` (buffer and counts) or `downloadKitchenGLB(scene, projectName)` (download).

## Developer enablement

The export UI is enabled for authenticated `admin` and `designer` sessions, and export rechecks the server session before downloading. No public feature flag is required. Credentials and the signed-session secret come from `ASAB_ADMIN_PASSWORD`, `ASAB_DESIGNER_PASSWORD`, and `ASAB_INTERNAL_SESSION_SECRET`. Set strong values in deployment. Internal users can generate/save configurations and export documents without customer contact popups; customer email and phone requirements remain unchanged.

## Custom cabinets

Cabinets retain their catalog `standardWidth` and SKU. Custom widths reuse the original GLB with local X scale = requested width / standard width; Y and Z stay unchanged. Width changes preserve the model origin, including rotated walls and free placements. Panel thickness scales along X. Japandi and Franc handles retain their original dimensions around their centres while their placement follows the resized door. Germain handles/gola profiles scale with the cabinet width. Corner resizing remains disabled.

Custom prices use the same width ratio: dimensional adjustment = standard price × (width ratio − 1), rounded to RON. The existing production surcharge and minimum price still apply. Custom cabinet labels include `***dimensiune personalizata`, removed when reset to standard width.

Free-placement cabinets use their GLB with the stored rotation and position. Wall worktops and plinths ignore detached free cabinets; automatic island grouping/worktops are reserved for a later implementation.

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
