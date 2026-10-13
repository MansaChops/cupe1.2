import { useEffect, useState } from 'react'
import { Link, Outlet, createFileRoute, notFound, redirect, useRouterState } from '@tanstack/react-router'
import { logout } from '@netlify/identity'
import { BarChart3, Boxes, ClipboardList, Database, Image, LayoutGrid, LogOut, Menu, Settings, Store, Tag, Users, X, ScrollText } from 'lucide-react'
import { img, site } from '@/config/site'
import { api, type Report } from '@/lib/admin-types'
import { getAdminSession, type AdminSession } from '@/server/admin'

export const Route = createFileRoute('/admin')({
  // Every /admin page requires a Netlify Identity user with a management role, checked on the
  // server. Anyone else gets a 404, so the area isn't advertised; the sign-in lives at /#management.
  // The admin API functions check again independently, so this is not the only guard.
  beforeLoad: async ({ location }): Promise<{ admin: AdminSession }> => {
    const admin = await getAdminSession()
    if (!admin) throw notFound()
    if (location.pathname === '/admin' || location.pathname === '/admin/') throw redirect({ to: '/admin/dashboard' })
    return { admin }
  },
  head: () => ({ meta: [{ title: `Management — ${site.name}` }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: AdminLayout,
})

const pages = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/discounts', label: 'Discounts', icon: Tag },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/products', label: 'Product images', icon: Image },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/data', label: 'Demo data', icon: Database },
] as const

// Phone bottom bar: the four most-used pages, plus "More" which opens the rest.
const tabs = pages.slice(0, 4)
const more = pages.slice(4)

const upcoming = [
  { label: 'Customers', icon: Users },
  { label: 'Logs', icon: ScrollText },
]

const signOut = async () => {
  await logout().catch(() => {})
  window.location.href = '/'
}

function AdminLayout() {
  const { admin } = Route.useRouteContext()
  const [toPack, setToPack] = useState(0)
  const [sheet, setSheet] = useState(false)
  const path = useRouterState({ select: (s) => s.location.pathname })
  const who = admin.name ?? admin.email

  useEffect(() => {
    api<Report>('/api/admin/reports?days=1')
      .then((r) => setToPack(r.kpis.toPack))
      .catch(() => {})
  }, [path])
  useEffect(() => setSheet(false), [path])

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr] bg-paper">
      <aside className="no-print hidden md:flex flex-col border-r border-line bg-paper-2/60 px-4 py-5 sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2.5 px-2">
          <img src={img(site.logoMark, 80, 80)} alt="" width={36} height={36} className="size-9 rounded-lg" />
          <span className="grid leading-tight">
            <span className="font-display text-lg">{site.name}</span>
            <span className="label text-ink-3">Management</span>
          </span>
        </Link>
        <nav className="mt-8 grid gap-0.5 text-sm">
          {pages.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-ink-2 hover:bg-card hover:text-ink"
              activeProps={{ className: '!bg-card !text-ink shadow-[0_1px_0_var(--color-line)]' }}
            >
              <Icon size={17} />
              {label}
              {to === '/admin/orders' && toPack > 0 && (
                <span className="ml-auto rounded-full bg-verdigris px-1.5 font-mono text-[10px] text-paper" title="Orders to pack">{toPack}</span>
              )}
            </Link>
          ))}
          <p className="label text-ink-3 px-2.5 mt-6 mb-2">Coming next</p>
          {upcoming.map(({ label, icon: Icon }) => (
            <span key={label} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-ink-3/80 cursor-default" title="Planned in the roadmap">
              <Icon size={17} />
              {label}
            </span>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-line bg-card p-3 text-xs">
          <p className="font-medium truncate" title={admin.email}>{who}</p>
          <p className="text-ink-3 truncate">{admin.name ? admin.email : ''}</p>
          <p className="text-ink-3 capitalize">{admin.role.toLowerCase()}{admin.role !== 'OWNER' && ' · view only'}</p>
          <button onClick={signOut} className="mt-2 inline-flex items-center gap-1.5 text-ink-2 hover:text-ink"><LogOut size={13} /> Sign out</button>
        </div>
      </aside>

      <div className="min-w-0 pb-20 md:pb-0">
        <div className="no-print md:hidden flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-xs">
          <span className="truncate text-ink-2">{who} · <span className="capitalize">{admin.role.toLowerCase()}</span></span>
          <button onClick={signOut} className="inline-flex items-center gap-1.5 text-ink-2"><LogOut size={13} /> Sign out</button>
        </div>
        <Outlet />
      </div>

      {/* Phone: "More" opens a sheet with the remaining pages */}
      {sheet && (
        <div className="no-print md:hidden fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" onClick={() => setSheet(false)}>
          <nav className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-paper px-5 pt-5 pb-24 rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="label text-ink-3">More</p>
              <button onClick={() => setSheet(false)} aria-label="Close" className="p-1"><X size={20} /></button>
            </div>
            <div className="mt-4 grid gap-1">
              {more.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className="flex items-center gap-4 rounded-xl px-3 py-3.5 font-display text-2xl hover:bg-card" activeProps={{ className: 'bg-card' }}>
                  <Icon size={20} className="text-ink-3" /> {label}
                </Link>
              ))}
              <Link to="/" className="flex items-center gap-4 rounded-xl px-3 py-3.5 font-display text-2xl hover:bg-card">
                <Store size={20} className="text-ink-3" /> Storefront
              </Link>
            </div>
          </nav>
        </div>
      )}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-[60] border-t border-line bg-paper/95 backdrop-blur grid grid-cols-5 text-[11px]">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="relative flex flex-col items-center gap-1 py-2.5 text-ink-3" activeProps={{ className: '!text-ink' }}>
            <Icon size={20} />
            {label}
            {to === '/admin/orders' && toPack > 0 && <span className="absolute top-1.5 right-[22%] rounded-full bg-verdigris px-1 font-mono text-[9px] text-paper">{toPack}</span>}
          </Link>
        ))}
        <button onClick={() => setSheet((s) => !s)} className={`flex flex-col items-center gap-1 py-2.5 ${sheet || more.some((m) => path.startsWith(m.to)) ? 'text-ink' : 'text-ink-3'}`} aria-expanded={sheet}>
          <Menu size={20} />
          More
        </button>
      </nav>
    </div>
  )
}
