import type { Config } from '@netlify/functions'
import { READ_ROLES, requireAdmin } from '../lib/auth.js'
import { buildReport, exportCsv } from '../lib/reports.js'

const headers = { 'Cache-Control': 'no-store' }

/**
 * GET /api/admin/reports?days=30            → dashboard/report data for the last N days
 * GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD[&demo=1]
 * GET /api/admin/export/:type.csv           → CSV (orders, order-items, inventory, customers, discounts)
 * Any management role.
 */
export default async (req: Request) => {
  const admin = await requireAdmin(req, READ_ROLES)
  if (admin instanceof Response) return admin
  const url = new URL(req.url)

  try {
    const csv = url.pathname.match(/^\/api\/admin\/export\/([a-z-]+)\.csv$/)
    if (csv) {
      const body = await exportCsv(csv[1], { status: url.searchParams.get('status') ?? undefined })
      if (body === null) return Response.json({ error: 'Unknown export.' }, { status: 404, headers })
      const stamp = new Date().toISOString().slice(0, 10)
      return new Response(body, {
        headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="cumbria-${csv[1]}-${stamp}.csv"` },
      })
    }

    const day = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null)
    const days = Math.min(366, Math.max(1, Number(url.searchParams.get('days')) || 30))
    const to = day(url.searchParams.get('to'))
    const end = to ? new Date(to.getTime() + 86_400_000) : new Date(Date.now() + 60_000)
    const start = day(url.searchParams.get('from')) ?? new Date(end.getTime() - days * 86_400_000)
    if (start >= end) return Response.json({ error: 'The start date must be before the end date.' }, { status: 400, headers })
    return Response.json(await buildReport(start, end, url.searchParams.get('demo') === '1'), { headers })
  } catch (err) {
    console.error('[admin-reports] failed', err)
    return Response.json({ error: 'The report could not be built. Please try again.' }, { status: 500, headers })
  }
}

export const config: Config = { path: ['/api/admin/reports', '/api/admin/export/:file'], method: ['GET'] }
