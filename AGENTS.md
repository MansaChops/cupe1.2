# AGENTS.md

Guide for AI agents and developers working on this codebase. **Continue from [PLAN.md](./PLAN.md).**
Milestones 1–3, 5, 6 (Slack + email), 7, 8 and most of 10 are complete, with one change of
direction: **there are no online payments** (milestone 4 is replaced by invoicing). Orders are
invoiced by email and the owner marks them paid in management.

## Project

Cumbria Peptides is a UK peptide e-commerce store with a hidden management area built for manual
fulfilment. The core flow is: customer places an order (optional discount code) → server creates the
order and reserves stock → invoice email + Slack + Google Sheets (outbox) → customer pays from the
invoice → owner marks paid → packs by hand → shipped with tracking (customer emailed) → completed.

**Architecture rule:** Netlify Database is the single source of truth. Slack, SMS, email and
Google Sheets are downstream and best-effort (outbox + retries). They must never block or cancel
an order.

## Stack

TanStack Start (React 19, TanStack Router file routes, SSR), Vite 7, Tailwind CSS 4, and
TypeScript strict, deployed on Netlify. Package manager: pnpm.

## Layout

```
src/
  config/site.ts          Brand, contact, currency, shipping rules, formatMoney(), img() CDN helper
  data/fixtures.ts        DEMO DATA: sample customers/orders for the admin Dashboard/Orders screens
                          and the demo seed. The storefront never reads it
  data/content.ts         Editable copy: homepage, reasons, FAQs, legal pages (drafts)
  lib/catalogue.ts        Catalogue types, categories, price/qty helpers, orderRef() (ORD-NNNNN)
  lib/cart.ts             Persistent basket (localStorage, variantId + qty only) + useCatalogue()
  server/catalogue.ts     Server functions: getCatalogue, getProduct, validateBasket
  server/admin.ts         Server function: getAdminSession (Identity user + name + role)
  lib/admin-types.ts      Shapes returned by /api/admin/* + api() fetch helper + pounds()
  lib/order-form.ts       Builds + submits the customer-order Netlify Forms payload
  components/store/       ProductCard, Summary, LegalPage
  components/admin/       ui.tsx (badges, Panel, PageHeader, fmtDate), charts.tsx (SVG area chart, BarList),
                          ManagementLogin.tsx (hidden /#management sign-in, invite, reset)
  routes/
    __root.tsx            HTML shell, global meta, 404 + 500, ManagementGate (lazy-loads the login on #management)
    _store.tsx            Storefront layout; loader = getCatalogue(), children use useCatalogue()
    _store/*.tsx          /, shop, product.$slug, cart, checkout, order-confirmed, about, faq, contact, legal
    admin.tsx             Management layout + server-side guard (404 when not signed in); phone "More" sheet
    admin.dashboard.tsx   KPIs, chart, top products, recent orders, low stock, failed notifications
    admin.orders.*.tsx    Order list and order page (payment, packing workflow, notes, resend, timeline)
    admin.inventory.tsx   Stock adjustments, prices, alert levels, product switches, history
    admin.discounts.tsx   Discount codes;  admin.reports.tsx: date-range reports + CSV exports
    admin.settings.tsx    Payment instructions, integration status/tests
    admin.products.tsx    Image upload;  admin.data.tsx: demo data
    sitemap[.]xml.ts      Server route generating sitemap.xml
db/schema.ts              Drizzle schema: all tables, enums, sequences (see README › Database)
netlify/database/migrations/  Generated SQL migrations (never edit a deployed one)
netlify/functions/
  orders.mts              POST /api/orders → lib/orders.placeOrder, then delivers the outbox rows
  order-status.mts        POST /api/order-status (order number + email must match)
  admin-orders.mts        /api/admin/orders (list), /:number (detail; POST = action)
  admin-inventory.mts     /api/admin/inventory (+ /movements, /adjust, /variants/:id, /products/:id)
  admin-discounts.mts     /api/admin/discounts (+ /:id)
  admin-reports.mts       /api/admin/reports, /api/admin/export/:type.csv
  admin-settings.mts      /api/admin/settings (+ /payment, /test)
  admin-demo-data.mts     /api/admin/demo-data: GET counts, POST seed, DELETE remove (confirmed)
  admin-products.mts      /api/admin/products (+ /:id/image upload/delete)
  media.mts               GET /media/products/:product/:file → Blobs (Image CDN source)
  retry-notifications.mts Scheduled (every minute): delivers due outbox rows (Slack, email, Sheets)
  sheets-nightly.mts      Scheduled (02:15 UTC): full Google Sheets rebuild
netlify/lib/              Server-only: catalogue, orders, order-ops, discounts, outbox, slack, email,
                          email-templates, sheets, reports, settings, demo-data, images, auth
scripts/seed-demo.ts      pnpm db:seed-demo (refuses production without ALLOW_PRODUCTION_SEED=1)
public/
  img/                    Generated product/hero imagery (always served via /.netlify/images)
  contact-form.html       Netlify Forms skeleton for the React contact form
  order-form.html         Netlify Forms skeleton for the customer-order submission
```

## Conventions

- Design tokens live in `src/styles.css` (`@theme`): paper/ink neutrals, verdigris accent, and
  oxblood/amber for alerts. Use the `.label` (mono eyebrow), `.btn`, `.btn-primary`, `.btn-ghost`
  and `.field` classes. Use `font-display` for headings.
- Always reference images through `img()` from `src/config/site.ts` (Netlify Image CDN, webp).
- Animations: `.rise` with an inline `--d` delay. Animate transform/opacity only. Reduced motion
  is respected.
- Brand name comes from `site.name`. Never hard-code it.
- **Compliance:** never write copy that claims health, medical, weight-loss, performance or
  similar outcomes. Product descriptions are owner-entered. Placeholders only describe format and
  storage.
- Admin pages must stay usable on mobile (cards instead of tables below `md`).

## Non-obvious decisions

- The basket stores only `{variantId, quantity}`. Display prices come from the server-loaded
  catalogue; `/api/orders` re-prices from the database inside the order transaction.
- Product and variant IDs are stable text keys (`prod_1`, `var_1_1`) because saved baskets and
  existing order items use them. Money is integer pence everywhere in the database.
- Order numbers are **never** generated client-side. Postgres assigns them from `order_number_seq`
  (default on `orders.number`), shown as `ORD-<n>` by `orderRef()` in `src/lib/catalogue.ts`.
  Orders placed before this were shown as `CP-YYYYMMDD-0NNNNN`; `parseOrderRef()` accepts both.
  The browser sends a `checkoutId` (UUID per details+basket); a repeat returns the saved order.
- `placeOrder()` locks the variant rows (`FOR UPDATE`, ID order), validates, inserts the order
  (`ON CONFLICT (checkout_id) DO NOTHING`), decrements stock with a `stock >= qty` guard and writes
  ORDER movements, items, a PENDING `manual` payment and the Slack outbox row in one transaction.
  Stock is reserved at order time. Restocking on cancellation is milestone 5.
- `is_demo` is set only by the demo seed. Demo removal deletes flagged rows, children first, and
  keeps flagged rows still referenced by real ones. A real order by a demo customer's email flips
  that customer to real.
- Server-only code lives in `netlify/lib/`. Browser code reaches it only via `src/server/*`
  server functions or `/api/*` functions. Don't import `db/` or `netlify/lib/` from components.
- Management APIs check the Identity user server-side (`requireAdmin`), with roles from
  `app_metadata.roles` (`owner`, `admin`, `packer`, `viewer`), and require a same-site `Origin`
  on writes. `oxleyj12e@gmail.com` (built in, `netlify/lib/auth.ts`) and emails in `OWNER_EMAILS` are always owners (the role is saved back to Identity on first
  sign-in). **Writes are owner-only** (`WRITE_ROLES`); every other role is read-only. The `/admin`
  layout guard is for UX (it returns 404 so the area isn't advertised); the API guard is the real one.
- The sign-in is hidden: nothing links to it. `ManagementGate` in `__root.tsx` opens
  `ManagementLogin` when the hash is `#management` or an Identity token (invite, recovery…). The
  invite screen collects a name (`user_metadata.full_name`) and password. `handleAuthCallback()`
  consumes the hash token, so it is memoised to run once per page load.
- Uploaded images: content-addressed keys in the `product-images` store, served by `media.mts`,
  always requested through the Image CDN via `img('/media/products/…')`.
- The local `netlify dev` database is PGlite with a single shared session: concurrent
  transactions interleave there. Test concurrency against a real Postgres.
- **No online payments** (owner's decision). Checkout = `/api/orders` **then** a Netlify Forms
  `customer-order` submission built from the server's response (`src/lib/order-form.ts`, skeleton
  `public/order-form.html`; keep their field names in sync). The confirmation page is shown only
  after both succeed. Orders are saved with payment `PENDING`; the invoice email carries the payment
  instructions from `settings` (key `payment`). Only an owner action (`mark_paid`) makes an order
  `PAID`. Nothing on the storefront ever does.
- Discount codes: `checkDiscountCode` (server fn) previews; `placeOrder` locks the code row
  (`FOR UPDATE`), re-checks it and increments `uses` in the order transaction. Cancelling or
  refunding before shipment releases the use. `orders.discount_code` is a text snapshot.
- Notification outbox (`netlify/lib/outbox.ts`): rows are inserted in the same transaction as the
  change (`enqueue`), delivered via `context.waitUntil`, then retried by the schedule. They never
  fail the order. A send first claims the row (`SENDING`, 2-minute lease) so overlapping runs can't
  double-send. Unconfigured channels become `SKIPPED`. Sheets rows collapse into one full resync.
  `enqueue(..., again=true)` re-arms a row for resends and repeated events. Slack messages carry
  name, email, phone, town/postcode, items and totals (owner's request), not the full address.
- Order actions (`netlify/lib/order-ops.ts`) lock the order row, enforce transitions
  (NEW → PACKING → PACKED → SHIPPED → COMPLETED; cancel from NEW/PACKING/PACKED), write
  `audit_logs` (entity `order`, id `ORD-…`; this is the order timeline) and queue notifications.
- Legal pages are separate static routes (`shipping.tsx`, etc.) sharing `LegalPage`, which keeps
  links type-safe.
- Admin "Coming next" nav items (Customers, Logs) are intentionally inert until their milestone ships.
- `tsconfig.json` doesn't include `.mts`; `pnpm typecheck` also runs `tsconfig.functions.json` for
  the functions. The two `sitemap[.]xml.ts` errors come from duplicate `@tanstack/router-core`
  versions in the lockfile (types only; runtime is fine).
- Local testing: `netlify dev` proxies to the Vite dev server. If `.netlify/v1` (from `vite build`)
  exists it serves the built SSR bundle instead and assets 404, so delete it before `netlify dev`.
