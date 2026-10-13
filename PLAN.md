# Cumbria Peptides — product roadmap

The system is built in self-contained milestones. Each one leaves the site deployable and adds
one layer of the full workflow:

**WEBSITE → ORDER → INVOICE EMAIL + SLACK + GOOGLE SHEETS → PAYMENT (marked by owner) → MANUAL PACKING → SHIPPING → COMPLETED**

Architecture rule for every milestone: **Netlify Database (Postgres) is the single source of truth.**
Slack is the communication layer, SMS is the alerting layer, Google Sheets is a reporting layer,
and email handles customer updates. No external integration can block or cancel an order. Failures
are recorded and retried.

---

## ✅ Milestone 1 — Product surface (done)

- Branded storefront: homepage, shop (search, category filters, in-stock filter, sort), product
  pages with variants, persistent basket with stock limits, two-step checkout with a
  confirm-details step, order confirmation (preview), about, contact (Netlify Forms), and five
  legal pages
- Admin: dashboard (KPIs, revenue chart, top products, low stock, failed notifications), searchable
  and filterable orders table, and an order page with the full packing workflow (Start packing →
  checklist → Mark packed → tracking → Mark shipped → Mark completed), integration status with
  retry buttons, timeline, inventory movements, and a printable packing slip
- Mobile-first layouts, including mobile admin with a bottom tab bar
- SEO basics: per-page titles and descriptions, Open Graph, Product JSON-LD, sitemap.xml, robots.txt
- All data comes from `src/data/fixtures.ts` (clearly labelled demo data)

## ✅ Milestone 2 — Database & catalogue (done)

- Drizzle schema in `db/schema.ts`: users, customers, products, product_variants, orders,
  order_items, payments, inventory_movements, notifications, audit_logs, webhook_events,
  settings, pages, costs
- Postgres sequence for order numbers, starting at 10001 (`ORD-10001`, never reused)
- `is_demo` flag on seeded rows, plus a single "Remove all demo data" action
- Replace the fixture reads in the storefront with server functions. Prices and stock are always
  read server-side.
- Product images stored in Netlify Blobs and served through the Image CDN
- Also landed early: stock decremented atomically at order time, admin sign-in with Identity roles
  guarding `/admin` and the admin APIs, `/admin/products` (image upload), `/admin/data`

## ✅ Milestone 3 — Authentication, roles & audit (done, except login rate limiting)

Done: hidden sign-in at `/#management` (invite → “Create your account” with name + password),
`/admin` returns 404 to everyone else, `OWNER_EMAILS` are owners, writes are owner-only, audit log
for order, stock, price, product, discount and settings changes.

Original scope:

- Netlify Identity sign-in at `/admin/login`, secure cookies, and server-side guards on every
  `/admin` route and admin server function
- Roles: OWNER (everything), ADMIN (orders/products/inventory), PACKER (orders/packing only),
  VIEWER (read-only reporting)
- Audit log for logins, status changes, price/stock/product edits, refunds and cancellations
- Rate limiting on login, checkout and contact endpoints

## ⛔ Milestone 4 — Replaced: no online payments (owner's decision)

Orders are invoiced by email with the owner's payment instructions (Settings) and marked paid in
management. Discount codes (% off, £ off, free delivery; minimum order, usage limits, dates, once
per customer) are applied at checkout and re-checked in the order transaction. The original Stripe
scope below is not planned.

Original scope:

- Server-side cart re-validation (price, stock, active status) → Stripe Checkout Session
- `/api/webhooks/stripe` with signature verification. Event IDs are stored in `webhook_events`, so
  duplicate or retried events are no-ops.
- On `checkout.session.completed`, one transaction creates the order, assigns the order number,
  decrements stock and writes inventory movements (`-2 · ORDER ORD-10025`)
- Handles failed and cancelled payments (no paid order is created) and full or partial refunds
  (`charge.refunded`)
- `/order-confirmed?session_id=…` loads the real order. Payment-failure and checkout-error pages.

## ✅ Milestone 5 — Order operations backend (done; refunds are recorded, paid back outside the site)

- Status transitions saved server-side with allowed-transition rules and audit entries
- Tracking numbers, admin notes, cancellation with restock, and refunds issued through Stripe
  from the admin panel
- Packing checklist state saved per order

## ✅ Milestone 6 — Notification outbox: Slack, email (done; SMS not started)

- `notifications` table used as an outbox, with one idempotency key per (order, event, channel)
- Scheduled/background function delivers with exponential backoff (1m, 4m, 16m, 1h, 4h) and
  posts to #system-alerts after the final failure
- Slack bot (Block Kit): new order with a **View order** button, status changes, low-stock alerts.
  Channel IDs configurable.
- Twilio SMS to the admin phone, carrying minimal data only. "Resend SMS" button.
- Customer emails: confirmation, packed, shipped (with tracking), completed, refund. Templates are
  editable in settings.

## ✅ Milestone 7 — Google Sheets reporting (done: service account, 5 tabs rebuilt per change + nightly)

- OAuth refresh-token client. The setup step creates the ORDERS, ORDER ITEMS, PRODUCTS, INVENTORY,
  CUSTOMERS, SALES, EXPENSES and DASHBOARD tabs.
- One-way sync from the database to Sheets through the outbox. Rows are keyed by order number, so
  they are upserted rather than duplicated.
- Inventory and sales tabs are rebuilt on a schedule. Sheets edits are never read back. The
  database stays authoritative.
- Per-order sync status, plus "Resync Google Sheet" on each order and a "Full resync" action

## ✅ Milestone 8 — Admin catalogue & inventory (inventory, prices and switches done; creating new products/variants remains)

- `/admin/products`, `/admin/products/new`, `/admin/products/:id`: create/edit products, variants,
  SKUs, prices, sale prices, images, category, featured, sort order, and archive instead of
  delete for anything that has orders
- `/admin/inventory`: stock levels, manual adjustments with a reason (`+50 · New supplier
  delivery`), movement history, low-stock thresholds and alerts

## Milestone 9 — Customers, privacy & accounts

- `/admin/customers` with order history, plus GDPR data export and erasure (anonymising order
  records)
- Cookie notice (essential-only by default) and data-retention settings
- Optional customer accounts: order history, status, and address management. Guest checkout stays
  the default.

## Milestone 10 — Reporting, exports & logs (reports page and CSV exports done; logs page and cost/profit settings remain)

- `/admin/analytics`: daily/weekly/monthly sales, AOV, best sellers, units, refunds, cancellations,
  shipping, Stripe fees, and estimated gross profit and margin from editable cost settings
- CSV exports: orders, order items, products, inventory, customers, sales
- `/admin/logs`: errors, failed payments/webhooks/integrations and auth events, with secrets redacted

## Milestone 11 — Settings, content & setup wizard

- `/admin/settings`: business details, currency, shipping rates, and editable homepage, legal pages
  and email templates
- `/admin/integrations`: connection status, Test connection, last success, last error, and
  reconnect for Stripe, Slack, Google Sheets, SMS and email
- First-run setup wizard (owner account → business → currency → Stripe → Slack → Sheets → SMS →
  test → first product → launch) and a maintenance mode page

## Milestone 12 — Hardening, testing & launch

- Security headers and CSP, input sanitisation review, and dependency audit
- Automated tests for the full 25-step workflow (payment success and failure, idempotent webhooks,
  price and stock tampering, out-of-stock purchases, role permissions, integration-failure
  resilience)
- Run a full demo order end to end, then the backup and restore procedure
- Deployment guide covering domain, HTTPS, Stripe/Slack/Google/Twilio setup, and the production
  launch checklist, including UK legal review of all policy pages and product copy
