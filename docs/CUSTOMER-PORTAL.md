# Phase 2 — ASAB customer accounts and saved kitchens

## Architecture

Supabase owns the ASAB portal identity, sign-in and private projects. Customers do not need to connect a WordPress or WooCommerce account. WooCommerce is the commerce backend: the later purchasing phase will create a cart/checkout from the technician-verified, accepted quote. It will not use a customer-provided total or create a payable cart from an unapproved draft.

The earlier account-bridge prototype has been removed from the application. Deactivate the **ASAB Portal Bridge** WordPress plugin if installed. Its bridge secret and `SUPABASE_SECRET_KEY` are no longer required by the portal. Do not deploy those unused variables with this application. The already-applied second migration includes a protected `portal_commerce_links` table; it is unused and grants no customer write access. Leave the applied migration intact.

## Included

- `/cont/autentificare`: passwordless email-code sign-in for new and existing customers.
- `/cont`: mobile-first dashboard showing the current customer's kitchens and editable profile.
- Configurator account bar: save a named kitchen; reopen it with `/?project=UUID`; autosave edits after two seconds into immutable revisions.
- Stale saves return 409 and require reloading. Leaving with unsaved changes triggers the browser warning.
- Rename, duplicate and archive owned drafts. Copies start as drafts without assignments, room approvals, quotes or orders. Archived records stay stored but leave the main dashboard.
- Contact details, staff flags and authentication tokens are excluded from kitchen snapshots.
- HttpOnly, SameSite=Lax cookies; secure cookies in production; server-side token verification/refresh; same-origin checks for cookie-authenticated writes. No tokens in localStorage. The existing bearer API remains supported.

## Activate

Apply `supabase/migrations/202610220002_customer_portal.sql` **once**, after phase 1. This has already been applied to the current ASAB project. Do not rerun either migration.

Only these server environment variables are required:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
PORTAL_PUBLIC_URL=http://127.0.0.1:3011
```

For production set `PORTAL_PUBLIC_URL` to the exact HTTPS portal origin. No WooCommerce credentials or Supabase secret/service-role key are required for customer login or saved kitchens. Ordinary project requests forward the signed-in user's JWT and enforce database row-level security.

## Email confirmation and recovery

Supabase Authentication → URL Configuration:

- Site URL: `http://127.0.0.1:3011` while testing; the actual portal HTTPS origin before launch.
- Allowed redirect: `http://127.0.0.1:3011/api/portal/auth/confirm`, plus the exact production callback URL.

Keep confirmed-email registration and disable anonymous sign-ins. Configure a production SMTP sender before public registration. Test actual email delivery; API mocks do not verify SMTP.

Signup/recovery use PKCE. Default `{{ .ConfirmationURL }}` templates exchange a code on the server using a verifier in an HttpOnly cookie. Open the email in the same browser that requested it. Session tokens stay out of URL fragments and client storage.

Direct token-hash templates are also supported:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/api/portal/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirma contul ASAB</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/api/portal/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reseteaza parola</a>
```

Direct signup links confirm email and return to sign-in. PKCE signup links sign in the initiating browser. Recovery opens `/cont/resetare`; the customer enters their own new password. Expired/unbound links return to sign-in.

## Tests

```sh
node tests/portalApi.mjs
node tests/customerPortal.mjs
PGLITE_MODULE=/tmp/asab-portal-test/node_modules/@electric-sql/pglite/dist/index.js node tests/portalDatabase.mjs
npm run build
```

The database test uses ephemeral PostgreSQL. It verifies ownership, assignments, role escalation protection, immutable revisions, stale saves, draft duplication/archiving, and protection of the unused commerce-link table.

Live browser acceptance completed: login, save, reopen, finish change → revision 2, duplicate, rename and archive. A clearly labelled original test kitchen remains in the administrator's own dashboard; its test copy was archived. Customer accounts use the same UI with their own projects.

Run one Next.js dev server per checkout; do not run a build concurrently with a dev server sharing `.next`. No Phase 2 deployment or Git push has been performed.

Room submission, online verification, quotes and WooCommerce cart/checkout creation remain subsequent phases. The existing Shopify purchase flow is a separate legacy integration, scheduled for replacement in the WooCommerce purchasing phase.

## Passwordless customer sign-in

Customers enter an email address, request a one-time code and confirm it in the portal. Supabase verifies the code and creates new users through the same flow. Existing kitchens remain attached to the same Supabase user. Legacy password/recovery endpoints remain compatible, but the public sign-in page requires no password.

In Supabase Authentication → Email Templates, update both Magic Link and Confirm Signup to include `{{ .Token }}`. A ready-to-paste template is available at `docs/portal-email-code.html`. Keep Email authentication enabled. Set the code expiry in the Email provider settings.

Configure custom SMTP before opening registration to customers: Supabase built-in email only serves organization team addresses and has a small hourly limit. Test real delivery and a complete code sign-in; automated API tests do not verify email delivery. No new SQL migration is required.

## Guest entry before email verification

The default `/cont/autentificare` page accepts an email and starts a guest configuration without contacting Supabase or creating a session. The email is an unverified hint in sessionStorage, scoped to that browser tab. No account data can be read or saved from it. Existing-customer sign-in uses `?intent=login`; saving a guest draft uses `?intent=save&next=...` and requires an emailed code.

The configurator stores a pending kitchen snapshot and its wizard step before leaving for sign-in. After verification the draft is restored and the customer names it before saving. Cancelling sign-in returns to the pending guest draft. This temporary handoff is not cloud storage: closing the tab can discard an unsaved draft. No database migration is needed.
