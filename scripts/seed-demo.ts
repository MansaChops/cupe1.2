/**
 * Loads sample data (customers, orders, payments, stock movements, costs, a page and a hidden
 * product), every row flagged is_demo = true. Never updates or reclassifies real rows, and does
 * nothing if demo orders already exist. Remove it again from /admin/data ("Remove all demo data").
 *
 *   pnpm db:seed-demo                 # against the database in NETLIFY_DB_URL
 *
 * Refuses to run against the production branch unless ALLOW_PRODUCTION_SEED=1 is set. (The same
 * seed is available to signed-in admins as "Load sample data" on /admin/data.)
 */
import { demoSummary, seedDemoData } from '../netlify/lib/demo-data.js'

if (!process.env.NETLIFY_DB_URL) {
  console.error('NETLIFY_DB_URL is not set. Run inside `netlify dev:exec`, or export the branch connection string first.')
  process.exit(1)
}
if (process.env.NETLIFY_DB_BRANCH === 'production' && process.env.ALLOW_PRODUCTION_SEED !== '1') {
  console.error('Refusing to seed demo data into the production database. Set ALLOW_PRODUCTION_SEED=1 to override.')
  process.exit(1)
}

const result = await seedDemoData()
console.log(result.seeded ? `Seeded ${result.customers} demo customers and ${result.orders} demo orders.` : result.reason)
console.table(await demoSummary())
process.exit(0)
