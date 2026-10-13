import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, History, Minus, Pencil, Plus, Search } from 'lucide-react'
import { api, pounds, type InventoryRow, type Movement } from '@/lib/admin-types'
import { ErrorNote, PageHeader, Panel, ReadOnlyNote, fmtDate } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/inventory')({
  head: () => ({ meta: [{ title: 'Inventory — Management' }] }),
  component: Inventory,
})

type Group = { productId: string; productName: string; productActive: boolean; preOrder: boolean; featured: boolean; isDemo: boolean; variants: Array<InventoryRow> }

const toPence = (s: string) => {
  const n = Number(s.replace(/[£,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

function Inventory() {
  const { admin } = Route.useRouteContext()
  const canEdit = admin.role === 'OWNER'
  const [rows, setRows] = useState<Array<InventoryRow> | null>(null)
  const [history, setHistory] = useState<Array<Movement>>([])
  const [historyFor, setHistoryFor] = useState<InventoryRow | null>(null)
  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [error, setError] = useState('')

  const load = () => api<Array<InventoryRow>>('/api/admin/inventory').then(setRows).catch((e) => setError(e.message))
  const loadHistory = (v: InventoryRow | null) =>
    api<Array<Movement>>(`/api/admin/inventory/movements${v ? `?variant=${encodeURIComponent(v.variantId)}` : ''}`).then(setHistory).catch(() => {})
  useEffect(() => {
    load()
    loadHistory(null)
  }, [])

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const map = new Map<string, Group>()
    for (const r of rows ?? []) {
      if (needle && !`${r.productName} ${r.variantName} ${r.sku}`.toLowerCase().includes(needle)) continue
      if (lowOnly && (r.preOrder || r.stock > r.lowStockThreshold)) continue
      const g = map.get(r.productId) ?? { productId: r.productId, productName: r.productName, productActive: r.productActive, preOrder: r.preOrder, featured: r.featured, isDemo: r.isDemo, variants: [] }
      g.variants.push(r)
      map.set(r.productId, g)
    }
    return [...map.values()]
  }, [rows, q, lowOnly])

  const totals = useMemo(() => {
    const live = (rows ?? []).filter((r) => r.productActive && r.active && !r.preOrder)
    return {
      units: live.reduce((n, r) => n + r.stock, 0),
      value: live.reduce((n, r) => n + r.stock * (r.salePricePence ?? r.pricePence), 0),
      low: live.filter((r) => r.stock <= r.lowStockThreshold).length,
      out: live.filter((r) => r.stock === 0).length,
    }
  }, [rows])

  const patchProduct = async (g: Group, body: Partial<Pick<Group, 'productActive' | 'preOrder' | 'featured'>>) => {
    setError('')
    try {
      await api(`/api/admin/inventory/products/${encodeURIComponent(g.productId)}`, {
        method: 'PATCH',
        json: { active: body.productActive, preOrder: body.preOrder, featured: body.featured },
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const showHistory = (v: InventoryRow) => {
    setHistoryFor(v)
    loadHistory(v)
    setTimeout(() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-6 md:py-8">
      <PageHeader eyebrow="Stock management" title="Inventory">
        <a className="btn btn-ghost !py-2 text-sm" href="/api/admin/export/inventory.csv"><Download size={15} /> Export CSV</a>
      </PageHeader>
      {!canEdit && <ReadOnlyNote />}
      <ErrorNote>{error}</ErrorNote>

      {rows && (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-2xl overflow-hidden">
          {[
            ['Units in stock', String(totals.units)],
            ['Stock value (at sale price)', pounds(totals.value)],
            ['Low stock', String(totals.low)],
            ['Out of stock', String(totals.out)],
          ].map(([k, v]) => (
            <div key={k} className="bg-card p-4 md:p-5">
              <p className="label text-ink-3">{k}</p>
              <p className="font-display text-3xl mt-2">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <label className="relative flex-1 min-w-60">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="field !pl-9 !py-2.5 text-sm" placeholder="Product, size or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
          <input type="checkbox" className="accent-verdigris" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
        </label>
      </div>

      {!rows && !error && <p className="mt-8 text-sm text-ink-3">Loading…</p>}

      <div className="mt-4 grid gap-4">
        {groups.map((g) => (
          <Panel key={g.productId} className="overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl">{g.productName}</h2>
                {g.isDemo && <span className="label rounded-full bg-amber-soft text-amber px-2 py-0.5">Demo</span>}
                {!g.productActive && <span className="label rounded-full bg-paper-2 text-ink-3 px-2 py-0.5">Hidden</span>}
                {g.preOrder && <span className="label rounded-full bg-amber-soft text-amber px-2 py-0.5">Pre-order</span>}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <Toggle label="On sale" on={g.productActive} onChange={(v) => patchProduct(g, { productActive: v })} />
                  <Toggle label="Pre-order" on={g.preOrder} onChange={(v) => patchProduct(g, { preOrder: v })} />
                  <Toggle label="Featured" on={g.featured} onChange={(v) => patchProduct(g, { featured: v })} />
                </div>
              )}
            </header>
            <ul className="divide-y divide-line">
              {g.variants.map((v) => (
                <VariantRow key={v.variantId} v={v} canEdit={canEdit} onSaved={load} onHistory={() => showHistory(v)} onError={setError} />
              ))}
            </ul>
          </Panel>
        ))}
        {rows && !groups.length && <p className="py-12 text-center text-sm text-ink-3">Nothing matches.</p>}
      </div>

      <Panel
        title={historyFor ? `Stock history · ${historyFor.productName} ${historyFor.variantName}` : 'Stock history · all products'}
        className="mt-8 scroll-mt-6"
        action={historyFor && <button className="text-xs text-verdigris" onClick={() => { setHistoryFor(null); loadHistory(null) }}>Show all</button>}
      >
        <div id="history" />
        {history.length ? (
          <ul className="border-t border-line divide-y divide-line text-sm">
            {history.map((m) => (
              <li key={m.id} className="grid grid-cols-[4rem_1fr_auto] md:grid-cols-[9rem_1fr_6rem_5rem] gap-3 px-5 py-2.5 items-center">
                <span className="text-xs text-ink-3">{fmtDate(m.createdAt)}</span>
                <span className="min-w-0">
                  <span className="truncate block">{m.productName} <span className="text-ink-3">{m.variantName}</span></span>
                  <span className="text-xs text-ink-3 truncate block">{m.reason.toLowerCase()} · {m.note}{m.actor && ` · ${m.actor}`}</span>
                </span>
                <span className={`font-mono text-right ${m.delta < 0 ? 'text-oxblood' : 'text-verdigris'}`}>{m.delta > 0 ? `+${m.delta}` : `−${-m.delta}`}</span>
                <span className="hidden md:block font-mono text-right text-ink-3">→ {m.stockAfter}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink-3">No stock movements yet.</p>
        )}
      </Panel>
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-ink-2 hover:text-ink">
      <span className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-verdigris' : 'bg-line'}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-paper transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

function VariantRow({ v, canEdit, onSaved, onHistory, onError }: { v: InventoryRow; canEdit: boolean; onSaved: () => Promise<unknown>; onHistory: () => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<null | 'adjust' | 'edit'>(null)
  const [busy, setBusy] = useState(false)
  const [adj, setAdj] = useState({ mode: 'add' as 'add' | 'remove' | 'set', quantity: '', note: '' })
  const [edit, setEdit] = useState({ price: '', sale: '', threshold: '', max: '' })
  const low = !v.preOrder && v.stock <= v.lowStockThreshold

  const open = (m: 'adjust' | 'edit') => {
    setMode(mode === m ? null : m)
    setEdit({
      price: (v.pricePence / 100).toFixed(2),
      sale: v.salePricePence === null ? '' : (v.salePricePence / 100).toFixed(2),
      threshold: String(v.lowStockThreshold),
      max: v.maxPerOrder === null ? '' : String(v.maxPerOrder),
    })
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    onError('')
    try {
      await fn()
      await onSaved()
      setMode(null)
      setAdj({ mode: 'add', quantity: '', note: '' })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const saveAdjust = (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = Number(adj.quantity)
    if (!Number.isInteger(quantity) || quantity < 0) return onError('Enter a whole number of units.')
    run(() => api('/api/admin/inventory/adjust', { method: 'POST', json: { variantId: v.variantId, mode: adj.mode, quantity, note: adj.note } }))
  }

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const pricePence = toPence(edit.price)
    if (!pricePence) return onError('Enter a valid price.')
    const salePricePence = edit.sale.trim() ? toPence(edit.sale) : null
    if (edit.sale.trim() && !salePricePence) return onError('Enter a valid sale price, or leave it empty.')
    const threshold = Number(edit.threshold)
    const max = edit.max.trim() ? Number(edit.max) : null
    if (!Number.isInteger(threshold) || threshold < 0) return onError('The alert level must be a whole number.')
    if (max !== null && (!Number.isInteger(max) || max < 1)) return onError('The per-order limit must be a whole number, or empty.')
    run(() =>
      api(`/api/admin/inventory/variants/${encodeURIComponent(v.variantId)}`, {
        method: 'PATCH',
        json: { pricePence, salePricePence, lowStockThreshold: threshold, maxPerOrder: max },
      }),
    )
  }

  return (
    <li className={`px-5 py-3.5 ${!v.active ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1.4fr_0.8fr_0.9fr_0.6fr_auto] items-center gap-3 md:gap-4">
        <div className="min-w-0">
          <p className="font-medium">{v.variantName}{!v.active && <span className="label ml-2 text-ink-3">Hidden size</span>}</p>
          <p className="font-mono text-[11px] text-ink-3">{v.sku}{v.packSize > 1 && ` · sold in ${v.packSize}s`}</p>
        </div>
        <div className="text-right md:text-left">
          <p className={`font-display text-3xl leading-none ${v.stock === 0 && !v.preOrder ? 'text-oxblood' : low ? 'text-amber' : ''}`}>{v.stock}</p>
          <p className="text-[11px] text-ink-3 mt-1">alert at {v.lowStockThreshold}</p>
        </div>
        <div className="text-sm">
          {v.salePricePence !== null ? (
            <><span className="text-verdigris">{pounds(v.salePricePence)}</span> <s className="text-ink-3">{pounds(v.pricePence)}</s></>
          ) : (
            pounds(v.pricePence)
          )}
          {v.maxPerOrder !== null && <p className="text-[11px] text-ink-3">max {v.maxPerOrder} per order</p>}
        </div>
        <p className="text-sm text-ink-2"><span className="font-mono">{v.sold30d}</span> <span className="text-ink-3 text-xs">sold · 30d</span></p>
        <div className="col-span-2 md:col-span-1 flex gap-1.5 justify-end">
          {canEdit && (
            <>
              <button className="btn btn-ghost !py-1.5 !px-3 text-xs" onClick={() => open('adjust')}><Plus size={13} />Stock</button>
              <button className="btn btn-ghost !py-1.5 !px-3 text-xs" onClick={() => open('edit')}><Pencil size={13} />Edit</button>
            </>
          )}
          <button className="btn btn-ghost !py-1.5 !px-3 text-xs" onClick={onHistory} aria-label="Stock history"><History size={13} /></button>
        </div>
      </div>

      {mode === 'adjust' && (
        <form onSubmit={saveAdjust} className="mt-3 rounded-xl border border-line bg-paper/60 p-4 grid gap-3 sm:grid-cols-[auto_8rem_1fr_auto] items-end">
          <div className="flex rounded-full border border-line p-0.5 text-sm">
            {(['add', 'remove', 'set'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setAdj({ ...adj, mode: m })} className={`rounded-full px-3 py-1.5 ${adj.mode === m ? 'bg-ink text-paper' : 'text-ink-2'}`}>
                {m === 'add' ? <><Plus size={12} className="inline" /> Add</> : m === 'remove' ? <><Minus size={12} className="inline" /> Remove</> : 'Set count'}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-xs text-ink-3">Units
            <input className="field !py-2" inputMode="numeric" value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value.replace(/\D/g, '') })} required autoFocus />
          </label>
          <label className="grid gap-1 text-xs text-ink-3">Reason
            <input className="field !py-2" value={adj.note} maxLength={200} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder={adj.mode === 'add' ? 'e.g. New supplier delivery' : adj.mode === 'remove' ? 'e.g. Damaged vial' : 'e.g. Stock count'} />
          </label>
          <button className="btn btn-primary !py-2" disabled={busy || !adj.quantity}>
            {busy ? 'Saving…' : adj.mode === 'set' ? `Set to ${adj.quantity || '…'}` : `${adj.mode === 'add' ? 'Add' : 'Remove'} ${adj.quantity || ''}`}
          </button>
        </form>
      )}

      {mode === 'edit' && (
        <form onSubmit={saveEdit} className="mt-3 rounded-xl border border-line bg-paper/60 p-4 grid gap-3 grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] items-end">
          <label className="grid gap-1 text-xs text-ink-3">Price £<input className="field !py-2" inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} required /></label>
          <label className="grid gap-1 text-xs text-ink-3">Sale price £ <span className="sr-only">(optional)</span><input className="field !py-2" inputMode="decimal" value={edit.sale} onChange={(e) => setEdit({ ...edit, sale: e.target.value })} placeholder="None" /></label>
          <label className="grid gap-1 text-xs text-ink-3">Alert at<input className="field !py-2" inputMode="numeric" value={edit.threshold} onChange={(e) => setEdit({ ...edit, threshold: e.target.value })} /></label>
          <label className="grid gap-1 text-xs text-ink-3">Max per order<input className="field !py-2" inputMode="numeric" value={edit.max} onChange={(e) => setEdit({ ...edit, max: e.target.value })} placeholder="No limit" /></label>
          <div className="col-span-2 sm:col-span-1 flex gap-2">
            <button className="btn btn-primary !py-2" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button
              type="button"
              className="btn btn-ghost !py-2"
              disabled={busy}
              onClick={() => run(() => api(`/api/admin/inventory/variants/${encodeURIComponent(v.variantId)}`, { method: 'PATCH', json: { active: !v.active } }))}
            >
              {v.active ? 'Hide size' : 'Show size'}
            </button>
          </div>
        </form>
      )}
    </li>
  )
}
