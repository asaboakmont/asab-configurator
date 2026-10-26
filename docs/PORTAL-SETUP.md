# ASAB portal — phase 1

Current customer login and saved-kitchen setup: see [CUSTOMER-PORTAL.md](CUSTOMER-PORTAL.md). WooCommerce accounts are not required; commerce handoff belongs to the approved-quote checkout phase.

This phase adds a database and authenticated API foundation. It does not expose a customer login/dashboard yet. Existing configurator, internal export login and Redis share links continue to operate independently. The new records have no TTL. No production database is provisioned or migrated automatically.

## New Supabase project

1. Create ae production use.
2. Apply `supabase/migrations/202610220001_portal_foundation.sql` once, through your migration tooling or the Supabase SQL editor. The migration is transactional and intentionally fails if applied twice; track it as an applied migration.
3. Set these **server environment variables** locally and in the deployment platform:

   ```dotenv
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

   A legacy Supabase **anon** key is also supported in `SUPABASE_PUBLISHABLE_KEY`. Do not use a secret/service-role key: it bypasses row security and the transport rejects it. No WooCommerce keys are needed for phase 1. Do not commit `.env.local`.
4. Configure Supabase Auth with verified email addresses and disable anonymous sign-ins. Configure SMTP, redirect allowlists and consumer/staff login screens during phase 2. Never derive staff roles from signup metadata.
5. Create/invite named staff users through the Supabase Auth dashboard. The database trigger creates a minimal profile; existing auth users are backfilled. Bootstrap the first ASAB organisation and administrator through the trusted SQL editor, replacing the UUID with the invited user's **Auth user ID**:

   ```sql
   begin;
   with organization as (
     insert into public.portal_organizations(name,kind)
     values ('ASAB','asab') returning id
   )
   insert into public.portal_memberships(organization_id,user_id,role)
   select id,'REPLACE_WITH_AUTH_USER_UUID'::uuid,'admin' from organization;
   commit;
   ```

   Add other named staff via trusted SQL using their organisation ID, Auth user ID and role (`designer`, `dealer`, `technician`). ASAB administrators require membership in an `asab` organisation. Dealer organisations should have `dealer` memberships. An organisation membership alone does **not** grant access to its customers' projects: explicitly assign each staff member to a project. The user-facing invitation/management UI belongs to phase 4.
6. Run the database tests locally (below), then smoke-test against a separate staging project with actual Supabase Auth sessions. The emulator verifies PostgreSQL behaviour; it does not replace testing hosted Auth/PostgREST integration.

## Data and access

- `portal_profiles`: own editable name/phone/city; administrators can read. Roles are held separately in protected `portal_memberships`.
- `portal_projects`: customer-owned project, status and current configuration version.
- `portal_assignments`: named staff access, scoped to an active organisation membership. Removing an assignment or disabling membership immediately removes that access.
- `portal_configuration_revisions`: immutable JSON snapshots. A row lock plus `expectedVersion` prevents silent overwrites. Saving is limited to `draft`/`changes_requested` projects.
- `portal_room_revisions`, `portal_verifications`: separate revision-linked room information and online review records. No home-visit workflow is introduced.
- `portal_quotes`, `portal_orders`: future server-written quote/order records with same-project foreign keys. Money is integer **bani**; WooCommerce order ID is the external reference. Workflow writers and server-authoritative pricing are intentionally deferred to phases 5–8; table presence does not enable checkout.
- `portal_assets`: private storage references only. No buckets, upload endpoints or signed download links are enabled in this phase.
- `portal_audit_events`: append-only through narrow functions; administrators can read. Stores identifiers/change types, not complete customer snapshots.

All tables use explicit grants and row-level security. Authenticated users have read access only where allowed by policies; direct INSERT/UPDATE/DELETE is denied. Writes use narrowly scoped functions with a fixed empty search path. Customers cannot change owners, assignments, staff roles, workflow status, quote totals or order IDs. Technicians can read assigned design/room information but cannot edit configurations or read quotes/orders. Designers/dealers can read and edit explicitly assigned drafts. Customers cannot see unissued draft quotes.

Business workflows for room submission, verification approval, quotes, payments and order transitions are **not writable** through the authenticated API yet. They require validated operations in later phases; do not enable broad table grants to build them. Staff role changes currently require trusted database administration. Back-office shared admin/designer cookies do not authenticate to these new APIs.

Configuration snapshots are design data, **not accepted quotes**. No commercial amount supplied in JSON is authoritative. Legacy `_lead`/customer detail fields are rejected at the top level; save profile/contact data separately. Existing anonymous Redis share links are not automatically imported into private projects or treated as evidence of ownership. Account identity linking to WordPress/WooCommerce will be implemented in phase 2; never link accounts solely because the browser submits a matching email or customer ID.

## API contract

Each request requires `Authorization: Bearer <Supabase user access token>`. The server validates the token through Supabase Auth and forwards it unchanged to PostgREST for RLS. Responses use `private, no-store`. Login, refresh, logout and WooCommerce SSO are not implemented in this phase; do not persist access tokens in application logs or manually expose them in URLs.

| Endpoint | Operation |
| --- | --- |
| `GET /api/portal/me` | Own profile and active memberships |
| `PATCH /api/portal/me` | Replace own `displayName`, `phone`, `city` |
| `GET /api/portal/projects?offset=0` | Up to 50 accessible projects; `nextOffset` for pagination |
| `POST /api/portal/projects` | Create own project: `{ "title": "Bucataria mea" }` |
| `GET /api/portal/projects/:id` | Read an accessible project |
| `PATCH /api/portal/projects/:id` | Rename: `{ "title": "Titlu nou" }` |
| `GET /api/portal/projects/:id/revisions?before=11` | Up to 10 snapshots, newest first; `nextBefore` for pagination |
| `POST /api/portal/projects/:id/revisions` | Append `{ "expectedVersion": 0, "configuration": { ... } }` |
| `POST /api/portal/admin/assignments` | ASAB admin only: `{ "projectId": "uuid", "organizationId": "uuid", "userId": "uuid", "remove": false }` |

Bodies are limited to 1 MiB. Missing/expired auth returns 401, forbidden mutations 403, inaccessible project reads 404, stale revisions 409 and missing configuration/upstream unavailability 503. Do not retry a 409 without reloading and resolving the edit. New operations have no effect on existing `/api/config/save` URLs.

## Verification

```sh
node tests/portalApi.mjs
npm install --prefix /tmp/asab-portal-test --no-audit --no-fund @electric-sql/pglite
PGLITE_MODULE=/tmp/asab-portal-test/node_modules/@electric-sql/pglite/dist/index.js node tests/portalDatabase.mjs
npm run build
```

`portalDatabase.mjs` creates an isolated, ephemeral PostgreSQL database with minimal Supabase Auth stubs. It tests ownership, assignment revocation, inactive staff, role escalation, immutable revisions, stale versions, technician restrictions, quote visibility, locked projects, audit access and anonymous denial. It never connects to customer data. PGlite is test tooling only and adds no application runtime dependency.

Production activation requires applying the migration and setting the two environment variables. Customer-facing account screens and secure WooCommerce account linking come next in phase 2.
