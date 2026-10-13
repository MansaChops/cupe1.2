import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Check, Database, Trash2 } from 'lucide-react'
import { Panel } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/data')({
  component: DemoData,
})

type Summary = Record<string, { demo: number; real: number }>
type Result = { deleted?: Record<string, number>; kept?: Record<string, number>; seeded?: boolean; reason?: string; summary: Summary }

const CONFIRM = 'REMOVE DEMO DATA'
const labels: Record<string, string> = {
  customers: 'Customers',
  orders: 'Orders',
  payments: 'Payments',
  inventoryMovements: 'Stock movements',
  products: 'Products',
  productVariants: 'Product variants',
  costs: 'Costs',
  pages: 'Pages',
}

function DemoData() {
  const { admin } = Route.useRouteContext()
  const allowed = admin.role === 'OWNER'
  const [summary, setSummary] = useState<Summary | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const call = async (method: 'GET' | 'POST' | 'DELETE', body?: unknown) => {
    setError('')
    const res = await fetch('/api/admin/demo-data', {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
    return data
  }

  useEffect(() => {
    if (allowed) call('GET').then(setSummary).catch((e) => setError(e.message))
  }, [])

  const totalDemo = summary ? Object.values(summary).reduce((n, r) => n + r.demo, 0) : 0

  const remove = async () => {
    setBusy(true)
    try {
      const r: Result = await call('DELETE', { confirm: typed })
      setSummary(r.summary)
      const n = Object.values(r.deleted ?? {}).reduce((a, b) => a + b, 0)
      const kept = Object.entries(r.kept ?? {}).filter(([, v]) => v > 0)
      setDone(`Removed ${n} demo records. All real records were left untouched.${kept.length ? ` Kept ${kept.map(([k, v]) => `${v} ${k}`).join(', ')} still linked to real records.` : ''}`)
      setConfirming(false)
      setTyped('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const seed = async () => {
    setBusy(true)
    try {
      const r: Result = await call('POST')
      setSummary(r.summary)
      setDone(r.seeded ? 'Sample data loaded. Every row is flagged as demo.' : (r.reason ?? 'Nothing to do.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-8 py-6 md:py-8">
      <p className="label text-ink-3">Database</p>
      <h1 className="font-display text-4xl md:text-5xl mt-1">Demo data</h1>
      <p className="text-sm text-ink-2 mt-2">
        Sample records are flagged as demo when they’re created. Removing them deletes only flagged records. Real customers, orders, payments, stock movements,
        notifications and the audit log are never touched.
      </p>

      {!allowed && <p className="mt-6 rounded-xl bg-amber-soft px-4 py-3 text-sm text-ink-2">Only the owner or an admin can manage demo data.</p>}
      {error && <p role="alert" className="mt-6 rounded-xl bg-oxblood-soft px-4 py-3 text-sm text-oxblood">{error}</p>}
      {done && <p role="status" className="mt-6 flex gap-2 rounded-xl bg-verdigris-soft px-4 py-3 text-sm text-verdigris"><Check size={16} className="shrink-0 mt-0.5" /> {done}</p>}

      {summary && (
        <Panel title="Records" className="mt-6">
          <table className="w-full text-sm">
            <thead className="text-ink-3 text-left border-t border-line">
              <tr><th className="font-normal px-5 py-2">Table</th><th className="font-normal px-5 py-2 text-right">Demo</th><th className="font-normal px-5 py-2 text-right">Real (kept)</th></tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([k, v]) => (
                <tr key={k} className="border-t border-line">
                  <td className="px-5 py-2">{labels[k] ?? k}</td>
                  <td className={`px-5 py-2 text-right font-mono ${v.demo ? 'text-amber' : 'text-ink-3'}`}>{v.demo}</td>
                  <td className="px-5 py-2 text-right font-mono">{v.real}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {summary && allowed && (
        <div className="mt-6 flex flex-wrap gap-3">
          {!confirming && (
            <button className="btn btn-primary !bg-oxblood !border-oxblood" disabled={busy || totalDemo === 0} onClick={() => { setConfirming(true); setDone('') }}>
              <Trash2 size={16} /> Remove all demo data
            </button>
          )}
          {!confirming && totalDemo === 0 && (
            <button className="btn btn-ghost" disabled={busy} onClick={seed}><Database size={16} /> Load sample data</button>
          )}
        </div>
      )}

      {confirming && (
        <Panel className="mt-6 p-5 border-oxblood/40">
          <p className="flex gap-2 font-medium text-oxblood"><AlertTriangle size={18} className="shrink-0" /> Permanently delete {totalDemo} demo records?</p>
          <p className="mt-2 text-sm text-ink-2">This can’t be undone. Type <span className="font-mono text-ink">{CONFIRM}</span> to confirm.</p>
          <input className="field mt-4 font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation text" autoFocus />
          <div className="mt-4 flex gap-3">
            <button className="btn btn-primary !bg-oxblood !border-oxblood" disabled={busy || typed !== CONFIRM} aria-busy={busy} onClick={remove}>
              {busy ? 'Removing…' : 'Delete demo data'}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => { setConfirming(false); setTyped('') }}>Cancel</button>
          </div>
        </Panel>
      )}
    </div>
  )
}
