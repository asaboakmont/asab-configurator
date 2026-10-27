# Internal design pieces

Admin/designer only: open “Piese si finisaje individuale” in the viewer. Choose a base, wall or tall band and add a front filler, full-height end panel or independent worktop. New filler/panel placement searches available wall slots without moving existing cabinets. Use the piece editor for dimensions, bottom elevation, wall distance, free X/Z centre and quarter-turn rotation. Free placement is manual and requires collision review in plan.

Default full heights are 862 / 700 / 2200 mm. Wall pieces start at 1500 mm. Base fillers start at the same 560 mm front-plane Z as the dishwasher front. Dimensions are stored in centimetres; UI displays millimetres. SKU includes kind, band, dimensions and collection. Panels are actual solid boards, without fabricated cabinet interiors.

Fillers and end panels have no approved tariff: price remains pending and is excluded from the explicitly partial quote until staff enters a VAT-inclusive manual price. Standard-depth independent worktops use 370 RON for a 2050 mm half board or 740 RON for a 4100 mm full board. Each independent top is billed separately; offcut sharing with other pieces is not assumed. Other depth/thickness or pieces longer than 4100 mm require a manual quote. Blank manual price resets to stock/pending pricing. Dimension changes invalidate a previously entered manual price.

Independent tops are additional by default. “Inlocuieste blatul automat” explicitly suppresses the selected automatic run in rendering and stock billing. Deleting the replacement restores that run. Designers must check corner joint lengths when replacing one leg of an L.

Select any cabinet to override its front, carcass, finish and hardware (including gold). Overrides survive saving and global finish changes; reset restores inheritance. Automatic worktop finish is set per wall/run; independent worktops have their own finish. Global gold hardware is internal only. Push-to-open models remain handleless.

PDF/PPTX include explicit pieces, dimensions, SKUs, pending-price labels and item finish overrides. Captured views use the actual customised scene. GLB metadata includes design-piece and colour-override data. Restricted configurations remain inaccessible through anonymous shared-config APIs. These features do not add a checkout or publish a catalogue product.

Automatic worktop stock is packed separately per finish. Matching explicit/global finishes may share stock; different finishes cannot share a board. Mirrored L return labels follow the actual cabinet wall.

Base fillers/end panels now participate in automatic worktop envelopes. Expand “Blaturi automate pe pereti” to adjust start and physical length per wall in mm. The same spans drive rendering and stock pricing; automatic reset resumes following the cabinet/panel edges. Different finish stock remains separate. Free-piece X/Z nudges apply immediately; exact coordinate edits use “Aplica dimensiuni si pozitie”. Coordinate form values refresh after every movement.

Restored wall-corner render copies are calibrated to 333mm front planes to align with native CS fronts, within the original nominal 1000 x 600mm footprint. Source GLBs, front thickness and handle dimensions are preserved; public legacy rendering remains unchanged.

Automatic recessed plinths also follow wall-aligned base filler/end-panel edges on each wall. Wall/tall pieces and free pieces do not extend them. Manual worktop overhangs affect only the worktop; plinth height and setback stay unchanged.

Restored wall-corner handles keep the handedness encoded in the STG/DR asset; the S/D opening field does not mirror their hardware separately from the doors. Smart falls back to public/models/2001-STG.glb and 2001-DR.glb, where both handles share one mesh. Handle triangles are partitioned by door face before rigid calibration; each visibility offset follows its own front normal. Franc uses its collection-specific assets. Source GLBs remain unchanged.

Internal wall-corner handles use the native wall-unit lower-edge baseline, 15.5mm above the carcass bottom. Smart legacy handles move down 21.5mm; Franc knobs approximately 5mm. Original hardware dimensions and public legacy heights are preserved.
