import { admin as identityAdmin, getUser, type User } from '@netlify/identity'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'

export type Role = (typeof users.$inferSelect)['role']
export type AdminUser = { id: number; identityId: string; email: string; name: string | null; role: Role }

/** Roles that may change anything (orders, stock, prices, discounts, settings). Everyone else is read-only. */
export const WRITE_ROLES: Array<Role> = ['OWNER']
export const READ_ROLES: Array<Role> = ['OWNER', 'ADMIN', 'PACKER', 'VIEWER']

// Emails that are always the owner: the built-in owner plus any in OWNER_EMAILS (comma-separated).
// The first time such a user signs in, the `owner` role is also saved on their Identity account so
// it shows in the Netlify UI.
const BUILT_IN_OWNERS = ['oxleyj12e@gmail.com']
export const ownerEmails = () => [
  ...new Set([...BUILT_IN_OWNERS, ...(process.env.OWNER_EMAILS ?? '').split(',')].map((e) => e.trim().toLowerCase()).filter(Boolean)),
]

// Netlify Identity roles (set on the user in the Netlify UI) mapped to admin roles. Users without
// one of these roles can sign in to Identity but cannot use the admin.
const ROLE_PRIORITY: Array<Role> = ['OWNER', 'ADMIN', 'PACKER', 'VIEWER']

function identityRoles(user: User) {
  const nested = (user.appMetadata?.authorization as { roles?: unknown } | undefined)?.roles
  const roles = [...(user.roles ?? []), ...(Array.isArray(nested) ? nested : [])]
  return roles.filter((r): r is string => typeof r === 'string').map((r) => r.toUpperCase())
}

/**
 * The signed-in admin, or null. Uses `getUser()`, which validates the `nf_jwt` session cookie
 * with Netlify Identity on the server. Also records the user in `users` so audit entries can
 * reference them.
 */
export async function currentAdmin(): Promise<AdminUser | null> {
  const user = await getUser()
  if (!user?.email) return null
  const granted = identityRoles(user)
  if (ownerEmails().includes(user.email.toLowerCase()) && !granted.includes('OWNER')) {
    granted.unshift('OWNER')
    await identityAdmin
      .updateUser(user.id, { app_metadata: { ...(user.appMetadata ?? {}), roles: [...new Set([...(user.roles ?? []), 'owner'])] } })
      .catch((err) => console.error('[auth] Could not save the owner role on the Identity user', err))
  }
  const role = ROLE_PRIORITY.find((r) => granted.includes(r))
  if (!role) return null

  const [row] = await db
    .insert(users)
    .values({ identityId: user.id, email: user.email, name: user.name ?? null, role, lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: users.identityId, set: { email: user.email, name: user.name ?? null, role, lastLoginAt: new Date(), updatedAt: new Date() } })
    .returning({ id: users.id })
  return { id: row.id, identityId: user.id, email: user.email, name: user.name ?? null, role }
}

const json = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * Guards an admin endpoint. Returns the admin, or a 401/403 Response to send back.
 * State-changing requests must also come from this site (Origin check), so a third-party page
 * can't trigger an action using the admin's session cookie.
 */
export async function requireAdmin(req: Request, allowed: Array<Role>): Promise<AdminUser | Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin')
    if (!origin || origin !== new URL(req.url).origin) return json(403, 'Request blocked: it did not come from this site.')
  }
  const admin = await currentAdmin()
  if (!admin) return json(401, 'Sign in with an admin account to do this.')
  if (!allowed.includes(admin.role)) return json(403, 'Your account doesn’t have permission to do this.')
  return admin
}
