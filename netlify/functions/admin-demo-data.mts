import type { Config } from '@netlify/functions'
import { READ_ROLES, WRITE_ROLES, requireAdmin } from '../lib/auth.js'
import { demoSummary, removeDemoData, seedDemoData } from '../lib/demo-data.js'

// Typed by the admin in the confirmation step; the server refuses the removal without it.
const REMOVE_CONFIRMATION = 'REMOVE DEMO DATA'

/**
 * GET    /api/admin/demo-data  → demo vs real row counts
 * POST   /api/admin/demo-data  → load sample data (all rows flagged is_demo)
 * DELETE /api/admin/demo-data  → "Remove all demo data" (body: { confirm: "REMOVE DEMO DATA" })
 * Reading: any management role. Changing: OWNER only.
 */
export default async (req: Request) => {
  const admin = await requireAdmin(req, req.method === 'GET' ? READ_ROLES : WRITE_ROLES)
  if (admin instanceof Response) return admin
  const headers = { 'Cache-Control': 'no-store' }

  try {
    if (req.method === 'GET') return Response.json(await demoSummary(), { headers })

    if (req.method === 'POST') {
      const result = await seedDemoData(admin)
      return Response.json({ ...result, summary: await demoSummary() }, { status: result.seeded ? 201 : 200, headers })
    }

    if (req.method === 'DELETE') {
      const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null
      if (body?.confirm !== REMOVE_CONFIRMATION) {
        return Response.json({ error: `Type ${REMOVE_CONFIRMATION} to confirm.` }, { status: 400, headers })
      }
      const result = await removeDemoData(admin)
      return Response.json({ ...result, summary: await demoSummary() }, { headers })
    }
  } catch (err) {
    console.error(`[admin-demo-data] ${req.method} failed`, err)
    return Response.json({ error: 'Something went wrong and nothing was changed. Please try again.' }, { status: 500, headers })
  }
  return Response.json({ error: 'Method not allowed' }, { status: 405, headers })
}

export const config: Config = { path: '/api/admin/demo-data', method: ['GET', 'POST', 'DELETE'] }
