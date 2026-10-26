# Internal preview rollout

The unfinished portal/login and native catalogue are restricted to signed-in ASAB admins and designers. The existing `Acces intern` entry remains available so staff can authenticate.

| Feature | Public | Signed admin/designer |
|---|---|---|
| Previous Japandi/Germain/Franc products and models | Yes | Retained as fallbacks |
| Smart and the new native catalogue | Hidden | Yes |
| Customer account/login/dashboard preview | Hidden; routes return 403 | Yes; customer authentication/RLS still required |
| HD renders and PowerPoint | Hidden | Yes |
| Detailed PDF, interiors, technical views and floor elevations | Yes | Yes |
| Room-height and cabinet editing controls | Hidden | Yes |

`middleware.ts` verifies the internal cookie signature and expiry using Web Crypto. It guards `/cont`, `/api/portal`, `/dev` and all three native model directories, with private/no-store responses. A cookie name, forged role, bearer customer token or client-side role is insufficient. Portal auth and data transport also check the internal role before contacting Supabase. Imported catalogue administration retains its existing admin-only permission.

The configurator waits for the internal-session lookup before restoring a saved kitchen. Public generation uses the legacy product mapping and 1469 mm hanging-cabinet base elevation; only internal mode loads native CAD models. When an internal session expires, the store regenerates the public configuration and removes SP/native catalogue state. Native configurations and newly saved internal configurations cannot be loaded publicly. Direct save/checkout guards detect preview-only configuration content.

The new PDF export is intentionally available to the public. It renders whichever scene is authorized for that user; public mode gets legacy models. Its existing customer contact/cart flow is retained. HD controls and the HD dialog require an internal role.

## Checks

- `node tests/internalPreview.mjs`: signed admin/designer access, forged/expired/absent-session rejection, public legacy generation, role-expiry reset and PDF/HD rollout contract.
- `node tests/customerPortal.mjs`: public email requests denied without provider calls; internal preview preserves OTP/PKCE, cookie and CSRF checks.
- `node tests/portalApi.mjs`: preview role plus verified customer JWT required; RLS tokens and ownership checks retained.
- `node tests/cabinetAlignment.mjs`, `node tests/designerPlacement.mjs`, `node tests/revisedPricing.mjs`: geometry, elevations, SP ceiling fit and PDF regression checks.
- Anonymous HTTP checks: public home/legacy model 200; portal pages/APIs/native models/internal configuration 403. Signed-in browser retains the new catalogue, room-height controls, HD and PowerPoint.
