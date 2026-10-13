# Cumbria Peptides — e-commerce & order management

A UK peptide storefront with a hidden management area for running manual fulfilment. Customers
browse, add items to their basket, apply a discount code and place an order. **No payment is taken
on the site:** the customer is emailed an invoice with your payment details, every order is posted
to Slack, and the Google Sheet report updates. You mark the order paid, pack it with a guided
checklist and printable packing slip, and mark it shipped with tracking (the customer is emailed
it).

> Brand name, logo and contact details live in `src/config/site.ts`.

## What's live

**Storefront** (each topic on its own page): `/`, `/shop`, `/product/:slug`, `/cart`, `/checkout`,
`/order-confirmed`, `/about`, `/faq`, `/contact`, `/shipping`, `/refunds`, `/terms`, `/privacy`,
`/disclaimer`, plus 404/500 pages, `sitemap.xml` and `robots.txt`.

Checkout sends only variant IDs, quantities and an optional discount code. The server re-prices the
basket from the database, checks the code, locks the stock rows, decrements stock and saves the
order in one transaction. Orders are numbered `ORD-10001`, `ORD-10002`… from a Postgres sequence
and saved with payment **Awaiting payment** (`PENDING`).

**Management** (hidden — sign in at **`/#management`**; `/admin/*` is a 404 for anyone else):

| Page | What it does |
| --- | --- |
| `/admin/dashboard` | To pack / to ship / awaiting payment / low stock, 30-day sales, top products, recent orders, failed notifications |
| `/admin/orders` | Search (name, email, phone, postcode, SKU, product, code), filter by status and payment, CSV export |
| `/admin/orders/:number` | Mark paid → start packing (checklist) → packed → ship with tracking → completed; cancel (restocks, releases the discount use), mark refunded, internal notes, resend invoice, notification status, timeline, packing slip |
| `/admin/inventory` | Stock per size, add / remove / set with a reason, prices and sale prices, low-stock alert level, per-order limit, show/hide, pre-order and featured switches, stock history |
| `/admin/discounts` | Create codes: % off, £ off or free delivery; minimum order, total uses, once per customer, start/end dates; uses and revenue per code |
| `/admin/reports` | Any date range: paid revenue, order value, awaiting payment, average order, discounts, customers, daily chart, best sellers, statuses; CSV exports (orders, order items, inventory, customers, discounts) |
| `/admin/settings` | Payment instructions printed on invoices, integration status and test buttons (Slack, email, Google Sheets) |
| `/admin/products` | Product photo upload |
| `/admin/data` | Load / remove demo data |

Only **owners** can change anything; other roles are view-only.

## Notifications (outbox)

Every order event writes rows to the `notifications` table in the same transaction, then they are
delivered straight away and retried with backoff (1m, 4m, 16m, 1h, 4h) by `retry-notifications`
(runs every minute). A channel that isn't configured is marked **skipped**, never blocks an order,
and can be resent from the order page once set up.

| Event | Slack | Customer email | Google Sheet |
| --- | --- | --- | --- |
| Order placed | New order (items, totals, discount, contact, town/postcode, **View order** button) | **Invoice** with payment details and due date (owner gets a BCC copy) | Synced |
| Marked paid | 💷 Payment received | Payment receipt | Synced |
| Shipped | 🚚 Tracking number | Tracking number + Royal Mail link | Synced |
| Cancelled | ✖️ Cancelled | Cancellation | Synced |
| Stock reaches its alert level | ⚠️ Low stock list | — | — |

The order is also still submitted to Netlify Forms (`customer-order`), which emails the owner.

## Setup

### 1. Management login for Joel (Netlify Identity)

1. Netlify → **Project configuration → Identity** → enable Identity, set **Registration** to
   **Invite only**.
2. **Environment variables**: `OWNER_EMAILS` = Joel's email (comma-separate more owners).
3. **Identity → Invite users** → Joel's email. The invite email opens the site with a
   **Create your account** screen: Joel enters his name and a password.
4. Sign in any time at **`https://<your-site>/#management`**. Joel becomes an owner automatically
   (the `owner` role is also saved on his Identity user). Others can be given the Identity role
   `admin`, `packer` or `viewer` for view-only access.

### 2. Slack (every order)

Create a Slack app → **Incoming Webhooks** → add to your orders channel → copy the URL into
`SLACK_WEBHOOK_URL`. (Or use `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID`.) Test it from
**Settings → Send test message**.

### 3. Email invoices (Resend)

1. Create a free account at resend.com, add and verify your domain (DNS records).
2. Create an API key → `RESEND_API_KEY`. Set `EMAIL_FROM` (e.g.
   `Cumbria Peptides <orders@yourdomain.co.uk>`) and `OWNER_EMAIL` (invoice copies).
3. In **Settings → Payment details on invoices**, enter how customers pay (e.g. bank details) and
   the number of days until payment is due.
4. **Settings → Send me a test invoice** emails you a copy of the latest invoice.

### 4. Google Sheets report

1. Google Cloud console → create a project → enable the **Google Sheets API**.
2. **IAM → Service accounts** → create one → **Keys → Add key → JSON**.
3. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` (`client_email`) and `GOOGLE_PRIVATE_KEY` (`private_key`,
   keep the `\n`s) from that file.
4. Create a Google Sheet, **Share** it with the service account email as **Editor**, and set
   `GOOGLE_SHEET_ID` (the ID in the sheet URL).
5. **Settings → Sync now**. Tabs **Orders, Order Items, Inventory, Daily Sales, Discounts** are
   created and rewritten from the database on every order change and nightly at 02:15. Edits in
   the sheet are overwritten; the database is the source of truth.

## Tech

- TanStack Start (React 19, file-based routing, SSR) on Netlify, Tailwind CSS 4
- Netlify Database (Postgres) with Drizzle ORM — `db/schema.ts`, migrations in
  `netlify/database/migrations/`
- Netlify Identity (management sign-in and roles), Netlify Blobs (product images), Netlify Image
  CDN, Netlify Forms (contact form and owner order emails)
- Slack, Resend (email) and Google Sheets through the notification outbox

## Where things live

| Path | What |
| --- | --- |
| `db/schema.ts` | All tables, enums, sequences and constraints |
| `netlify/lib/orders.ts` | Order creation transaction (pricing, discount, stock locking, numbering, outbox rows) |
| `netlify/lib/order-ops.ts` | Management order list/detail and status actions (with transition rules and audit log) |
| `netlify/lib/discounts.ts` | Discount code validation and amounts |
| `netlify/lib/outbox.ts` | Notification delivery and retries for Slack, email and Sheets |
| `netlify/lib/slack.ts`, `email.ts`, `email-templates.ts`, `sheets.ts` | The channels |
| `netlify/lib/reports.ts` | Dashboard/report queries, inventory, stock history, CSV exports |
| `netlify/lib/settings.ts` | Payment instructions (stored in `settings`) |
| `netlify/lib/auth.ts` | Management guard (Identity roles, `OWNER_EMAILS`, same-origin check) |
| `netlify/functions/` | `/api/orders`, `/api/order-status`, `/api/admin/*`, `/media/products/*`, scheduled retries and nightly Sheets sync |
| `src/components/admin/ManagementLogin.tsx` | The hidden `/#management` sign-in, invite and password-reset screens |
| `src/lib/admin-types.ts` | Shapes returned by the management APIs |

## Run locally

```bash
pnpm install
netlify dev --port 8889
netlify db migrations apply   # first run, and after pulling new migrations
```

`netlify dev` emulates the database (PGlite in `.netlify/db`), Blobs and the Image CDN. Identity
sign-in needs a deployed site (deploy previews work). `pnpm typecheck` checks the app and the
functions (`tsconfig.functions.json`).

> If `NETLIFY_DB_URL` is set in your shell, the `netlify db` commands use that database instead of
> the local one. The local emulator runs all connections through one session, so it can't be used
> to test concurrent transactions.

## Database

- **Change the schema** in `db/schema.ts`, then `pnpm db:generate --name <what_changed>`. Commit
  the generated folder. Never edit or delete a migration that has been deployed; add a new one.
- **Migrations are applied by Netlify** on every deploy.
- **Money** is integer pence. `orders.total_pence = subtotal + shipping − discount` (CHECK constraint).
- **Order numbers** come from `order_number_seq` (starts at 10001, never reused). Demo orders use
  `demo_order_number_seq` (`ORD-900001`…).
- **Stock** is reserved when an order is placed and returned when it's cancelled (or refunded before
  shipping). Every change writes an `inventory_movements` row; stock can never go below zero.
- **Discount codes** are locked during the order transaction so usage limits can't be exceeded;
  cancelling an order gives the use back.
- **No card data** is stored or taken. `payments` rows are `manual`.

### Demo data

`/admin/data` → **Load sample data** / **Remove all demo data** (type `REMOVE DEMO DATA`). Only
rows flagged `is_demo` are ever removed. Reports exclude demo orders unless you tick
**Include demo orders**.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NETLIFY_DB_URL` | Automatic | Postgres connection (set by Netlify) |
| `OWNER_EMAILS` | Yes | Comma-separated emails that are owners |
| `SLACK_WEBHOOK_URL` *or* `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` | For Slack | Order notifications |
| `RESEND_API_KEY`, `EMAIL_FROM` | For email | Invoices, receipts, tracking, cancellations |
| `OWNER_EMAIL` | Optional | BCC on invoices and reply-to (defaults to the site email) |
| `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | For Sheets | Report sync |
| `ALLOW_PRODUCTION_SEED` | No | Lets `pnpm db:seed-demo` write to production (shell only) |

Mark keys and tokens as secrets in Netlify.

## Before going live

- Enter your real payment details in **Settings**, and replace the placeholder phone number and
  address in `src/config/site.ts`.
- All legal pages and product descriptions are drafts (`src/data/content.ts`). Have them reviewed
  by a UK legal or regulatory adviser.

## Roadmap

See [PLAN.md](./PLAN.md).
