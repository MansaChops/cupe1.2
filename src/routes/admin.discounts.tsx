import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Plus, Trash2 } from 'lucide-react'
import { api, pounds, type DiscountCode } from '@/lib/admin-types'
import { ErrorNote, PageHeader, Panel, ReadOnlyNote, fmtDate } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/discounts')({
  head: () => ({ meta: [{ title: 'Discounts — Management' }] }),
  component: Discounts,
})

type Form = {
  code: string
  description: string
  type: DiscountCode['type']
  value: string
  min: string
  maxUses: string
  oncePerCustomer: boolean
  startsAt: string
  endsAt: string
  active: boolean
}
const blank: Form = { code: '', description: '', type: 'PERCENT', value: '10', min: '', maxUses: '', oncePerCustomer: false, startsAt: '', endsAt: '', active: true }

const describe = (d: Pick<DiscountCode, 'type' | 'value'>) => (d.type === 'FREE_SHIPPING' ? 'Free delivery' : d.type === 'PERCENT' ? `${d.value}% off` : `${pounds(d.value)} off`)
// <input type="date"> uses YYYY-MM-DD; dates start/end at UK midnight-ish (00:00 / 23:59 UTC is close enough for a shop).
const toIso = (date: string, end = false) => (date ? new Date(`${date}T${end ? '23:59:59' : '00:00:00'}Z`).toISOString() : null)
const fromIso = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

function status(d: DiscountCode) {
  const now = Date.now()
  if (!d.active) return { label: 'Off', tone: 'bg-paper-2 text-ink-3' }
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'bg-amber-soft text-amber' }
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return { label: 'Expired', tone: 'bg-paper-2 text-ink-3' }
  if (d.maxUses !== null && d.uses >= d.maxUses) return { label: 'Used up', tone: 'bg-paper-2 text-ink-3' }
  return { label: 'Live', tone: 'bg-verdigris-soft text-verdigris' }
}

function Discounts() {
  const { admin } = Route.useRouteContext()
  const canEdit = admin.role === 'OWNER'
  const [list, setList] = useState<Array<DiscountCode> | null>(null)
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api<Array<DiscountCode>>('/api/admin/discounts').then(setList).catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  const openEdit = (d: DiscountCode) =>
    setEditing({
      id: d.id,
      form: {
        code: d.code, description: d.description, type: d.type,
        value: d.type === 'FIXED' ? (d.value / 100).toFixed(2) : String(d.value || ''),
        min: d.minSubtotalPence ? (d.minSubtotalPence / 100).toFixed(2) : '', maxUses: d.maxUses === null ? '' : String(d.maxUses),
        oncePerCustomer: d.oncePerCustomer, startsAt: fromIso(d.startsAt), endsAt: fromIso(d.endsAt), active: d.active,
      },
    })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const f = editing.form
    const value = f.type === 'FIXED' ? Math.round(Number(f.value) * 100) : f.type === 'PERCENT' ? Number(f.value) : 0
    if (f.type !== 'FREE_SHIPPING' && !(value > 0)) return setError(f.type === 'PERCENT' ? 'Enter a percentage between 1 and 100.' : 'Enter the amount to take off.')
    const body = {
      code: f.code.trim(),
      description: f.description.trim(),
      type: f.type,
      value,
      minSubtotalPence: f.min.trim() ? Math.round(Number(f.min) * 100) : 0,
      maxUses: f.maxUses.trim() ? Number(f.maxUses) : null,
      oncePerCustomer: f.oncePerCustomer,
      startsAt: toIso(f.startsAt),
      endsAt: toIso(f.endsAt, true),
      active: f.active,
    }
    setBusy(true)
    setError('')
    try {
      await api(editing.id === null ? '/api/admin/discounts' : `/api/admin/discounts/${editing.id}`, { method: editing.id === null ? 'POST' : 'PATCH', json: body })
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (d: DiscountCode) => {
    setError('')
    try {
      await api(`/api/admin/discounts/${d.id}`, { method: 'PATCH', json: { active: !d.active } })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  const remove = async (d: DiscountCode) => {
    if (!confirm(d.uses ? `${d.code} has been used, so it will be switched off rather than deleted. Continue?` : `Delete ${d.code}?`)) return
    try {
      await api(`/api/admin/discounts/${d.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  const set = (p: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e))

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-6 md:py-8">
      <PageHeader eyebrow="Promotions" title="Discount codes">
        <div className="flex gap-2">
          <a className="btn btn-ghost !py-2 text-sm" href="/api/admin/export/discounts.csv"><Download size={15} /> Export CSV</a>
          {canEdit && <button className="btn btn-primary !py-2 text-sm" onClick={() => setEditing({ id: null, form: blank })}><Plus size={15} /> New code</button>}
        </div>
      </PageHeader>
      <p className="mt-3 text-sm text-ink-2 max-w-2xl">Customers enter codes at checkout. Percentage and fixed-amount codes come off the item subtotal; free-delivery codes remove the £ delivery charge. Every order re-checks the code on the server.</p>
      {!canEdit && <ReadOnlyNote />}
      <ErrorNote>{error}</ErrorNote>

      {editing && (
        <Panel title={editing.id === null ? 'New discount code' : `Edit ${editing.form.code}`} className="mt-6">
          <form onSubmit={save} className="px-5 pb-5 grid gap-4 md:grid-cols-4">
            <label className="grid gap-1.5 md:col-span-1">
              <span className="text-sm font-medium">Code</span>
              <input className="field font-mono uppercase" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_\-]+" value={editing.form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="WELCOME10" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Type</span>
              <select className="field" value={editing.form.type} onChange={(e) => set({ type: e.target.value as Form['type'] })}>
                <option value="PERCENT">Percentage off</option>
                <option value="FIXED">Fixed amount off</option>
                <option value="FREE_SHIPPING">Free delivery</option>
              </select>
            </label>
            {editing.form.type !== 'FREE_SHIPPING' ? (
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">{editing.form.type === 'PERCENT' ? 'Percent off' : 'Amount off (£)'}</span>
                <input className="field" inputMode="decimal" required value={editing.form.value} onChange={(e) => set({ value: e.target.value })} />
              </label>
            ) : <span className="hidden md:block" />}
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Minimum order (£) <span className="text-ink-3 font-normal">optional</span></span>
              <input className="field" inputMode="decimal" value={editing.form.min} onChange={(e) => set({ min: e.target.value })} placeholder="None" />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-sm font-medium">Description <span className="text-ink-3 font-normal">internal</span></span>
              <input className="field" maxLength={200} value={editing.form.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Instagram launch offer" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Starts <span className="text-ink-3 font-normal">optional</span></span>
              <input className="field" type="date" value={editing.form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Ends <span className="text-ink-3 font-normal">optional</span></span>
              <input className="field" type="date" value={editing.form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Total uses allowed</span>
              <input className="field" inputMode="numeric" value={editing.form.maxUses} onChange={(e) => set({ maxUses: e.target.value.replace(/\D/g, '') })} placeholder="Unlimited" />
            </label>
            <div className="md:col-span-3 flex flex-wrap items-center gap-6 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="accent-verdigris" checked={editing.form.oncePerCustomer} onChange={(e) => set({ oncePerCustomer: e.target.checked })} /> Once per customer email</label>
              <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="accent-verdigris" checked={editing.form.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
            </div>
            <div className="md:col-span-4 flex gap-2">
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing.id === null ? 'Create code' : 'Save changes'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </Panel>
      )}

      {!list && !error && <p className="mt-8 text-sm text-ink-3">Loading…</p>}
      {list && (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => {
            const s = status(d)
            return (
              <Panel key={d.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xl font-medium">{d.code}</p>
                    <p className="text-sm text-ink-2 mt-0.5">{describe(d)}{d.minSubtotalPence ? ` · orders over ${pounds(d.minSubtotalPence)}` : ''}</p>
                  </div>
                  <span className={`label rounded-full px-2.5 py-1 ${s.tone}`}>{s.label}</span>
                </div>
                {d.description && <p className="mt-2 text-sm text-ink-3">{d.description}</p>}
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="label text-ink-3">Used</dt><dd className="font-display text-2xl">{d.uses}{d.maxUses !== null && <span className="text-ink-3 text-base">/{d.maxUses}</span>}</dd></div>
                  <div><dt className="label text-ink-3">Sales</dt><dd className="font-display text-2xl">{pounds(d.revenuePence)}</dd></div>
                  <div><dt className="label text-ink-3">Given</dt><dd className="font-display text-2xl">{pounds(d.discountGivenPence)}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-ink-3">
                  {d.startsAt ? `From ${fmtDate(d.startsAt, false)}` : 'No start date'} · {d.endsAt ? `until ${fmtDate(d.endsAt, false)}` : 'no end date'}{d.oncePerCustomer && ' · once per customer'}
                </p>
                {canEdit && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-sm">
                    <button className="text-verdigris hover:underline" onClick={() => openEdit(d)}>Edit</button>
                    <button className="text-ink-2 hover:underline" onClick={() => toggle(d)}>{d.active ? 'Switch off' : 'Switch on'}</button>
                    <button className="ml-auto inline-flex items-center gap-1 text-ink-3 hover:text-oxblood" onClick={() => remove(d)}><Trash2 size={13} /> Delete</button>
                  </div>
                )}
              </Panel>
            )
          })}
          {!list.length && <p className="text-sm text-ink-3 md:col-span-3 py-10 text-center">No discount codes yet.{canEdit && ' Create one with “New code”.'}</p>}
        </div>
      )}
    </div>
  )
}
