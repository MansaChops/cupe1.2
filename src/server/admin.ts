import { createServerFn } from '@tanstack/react-start'
import { currentAdmin } from '../../netlify/lib/auth'

export type AdminSession = { email: string; name: string | null; role: 'OWNER' | 'ADMIN' | 'PACKER' | 'VIEWER' }

/** The signed-in admin (validated server-side with Netlify Identity), or null. */
export const getAdminSession = createServerFn({ method: 'GET' }).handler(async (): Promise<AdminSession | null> => {
  const admin = await currentAdmin()
  return admin ? { email: admin.email, name: admin.name, role: admin.role } : null
})
