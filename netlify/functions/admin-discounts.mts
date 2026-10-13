import type { Config, Context } from '@netlify/functions'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, discountCodes, orders } from '../../db/schema.js'
import { READ_ROLES, WRITE_ROLES, requireAdmin } from '../lib/auth.js'
import { normaliseCode } from '../lib/discounts.js'

const headers = { 'Cache-Control': 'no-store' }
const err = (status: number, error: string) => Response.json({ error }, { status, headers })

const Fields = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, - or _ only.'),
  description: z.string().trim().max(200).default(''),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  value: z.number().int().min(0).max(10_000_000).default(0),
  minSubtotalPence: z.number().int().min(0).max(10_000_000).default(0),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().default(null),
  oncePerCustomer: z.boolean().default(false),
  startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  active: z.boolean().default(true),
})

const check = (d: { type: string; value: number; startsAt: string | null; endsAt: string | null }) => {
  if (d.type === 'PERCENT' && (d.value < 1 || d.value > 100)) return 'A percentage must be between 1 and 100.'
  if (d.type === 'FIXED' && d.value < 1) return 'Enter the amount to take off.'
  if (d.startsAt && d.endsAt && d.startsAt >= d.endsAt) return 'The end date must be after the start date.'
  return null
}

const toRow = (d: z.infer<typeof Fields>) => ({
  ...d,
  code: normaliseCode(d.code),
  value: d.type === 'FREE_SHIPPING' ? 0 : d.value,
  startsAt: d.startsAt ? new Date(d.startsAt) : null,
  endsAt: d.endsAt ? new Date(d.endsAt) : null,
})

/**
 * GET    /api/admin/discounts        → every code with uses and the revenue it brought in
 * POST   /api/admin/discounts        → create a code
 * PATCH  /api/admin/discounts/:id    → edit (any fields) or switch on/off
 * DELETE /api/admin/discounts/:id    → delete a never-used code (used codes are switched off instead)
 * Reading: any management role. Changing: OWNER only.
 */
export default async (req: Request, context: Context) => {
  const admin = await requireAdmin(req, req.method === 'GET' ? READ_ROLES : WRITE_ROLES)
  if (admin instanceof Response) return admin
  const id = context.params.id ? Number(context.params.id) : null
  const audit = (action: string, entityId: string, details: Record<string, unknown>) =>
    db.insert(auditLogs).values({ userId: admin.id, actor: admin.name ?? admin.email, action, entityType: 'discount', entityId, details })

  try {
    if (req.method === 'GET') {
      const rows = await db
        .select({
          d: discountCodes,
          revenuePence: sql<number>`coalesce((SELECT sum(${orders.totalPence}) FROM ${orders} WHERE upper(${orders.discountCode}) = upper(${discountCodes.code}) AND ${orders.fulfilmentStatus} NOT IN ('CANCELLED', 'REFUNDED')), 0)::int`,
          discountGivenPence: sql<number>`coalesce((SELECT sum(${orders.discountPence}) FROM ${orders} WHERE upper(${orders.discountCode}) = upper(${discountCodes.code}) AND ${orders.fulfilmentStatus} NOT IN ('CANCELLED', 'REFUNDED')), 0)::int`,
        })
        .from(discountCodes)
        .orderBy(asc(discountCodes.code))
      return Response.json(
        rows.map(({ d, revenuePence, discountGivenPence }) => ({
          ...d, startsAt: d.startsAt?.toISOString() ?? null, endsAt: d.endsAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString(), revenuePence, discountGivenPence,
        })),
        { headers },
      )
    }

    if (req.method === 'POST' && id === null) {
      const parsed = Fields.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Check the details and try again.')
      const problem = check(parsed.data)
      if (problem) return err(400, problem)
      const [row] = await db.insert(discountCodes).values(toRow(parsed.data)).onConflictDoNothing().returning()
      if (!row) return err(409, `The code ${normaliseCode(parsed.data.code)} already exists.`)
      await audit('discount.create', row.code, parsed.data)
      return Response.json(row, { status: 201, headers })
    }

    if (id === null || !Number.isInteger(id)) return err(404, 'Not found')
    const [existing] = await db.select().from(discountCodes).where(eq(discountCodes.id, id))
    if (!existing) return err(404, 'Discount code not found.')

    if (req.method === 'PATCH') {
      const parsed = Fields.partial().safeParse(await req.json().catch(() => null))
      if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Check the details and try again.')
      const merged = {
        ...existing,
        ...parsed.data,
        startsAt: parsed.data.startsAt === undefined ? existing.startsAt?.toISOString() ?? null : parsed.data.startsAt,
        endsAt: parsed.data.endsAt === undefined ? existing.endsAt?.toISOString() ?? null : parsed.data.endsAt,
      }
      const problem = check(merged)
      if (problem) return err(400, problem)
      if (merged.maxUses !== null && merged.maxUses < existing.uses) return err(400, `It has already been used ${existing.uses} times.`)
      const { createdAt: _c, updatedAt: _u, id: _i, uses: _n, ...fields } = merged
      try {
        await db.update(discountCodes).set({ ...toRow(fields as z.infer<typeof Fields>), updatedAt: new Date() }).where(eq(discountCodes.id, id))
      } catch (e) {
        if (String(e).includes('discount_codes_code_key')) return err(409, 'Another code already uses that name.')
        throw e
      }
      await audit('discount.update', existing.code, parsed.data)
      return Response.json({ ok: true }, { headers })
    }

    if (req.method === 'DELETE') {
      if (existing.uses > 0) {
        await db.update(discountCodes).set({ active: false, updatedAt: new Date() }).where(eq(discountCodes.id, id))
        await audit('discount.disable', existing.code, { reason: 'delete requested on a used code' })
        return Response.json({ ok: true, disabled: true }, { headers })
      }
      await db.delete(discountCodes).where(eq(discountCodes.id, id))
      await audit('discount.delete', existing.code, {})
      return Response.json({ ok: true, deleted: true }, { headers })
    }
  } catch (e) {
    console.error(`[admin-discounts] ${req.method} failed`, e)
    return err(500, 'Something went wrong. Please try again.')
  }
  return err(405, 'Method not allowed')
}

export const config: Config = { path: ['/api/admin/discounts', '/api/admin/discounts/:id'], method: ['GET', 'POST', 'PATCH', 'DELETE'] }
