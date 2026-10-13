import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ImageOff, Upload } from 'lucide-react'
import { formatMoney, img } from '@/config/site'
import { Panel } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/products')({
  component: Products,
})

type AdminProduct = {
  id: string
  name: string
  slug: string
  active: boolean
  isDemo: boolean
  image: string
  hasUpload: boolean
  variants: Array<{ id: string; name: string; sku: string; price: number; stock: number; lowStockThreshold: number }>
}

const MAX_MB = 5
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'

function Products() {
  const { admin } = Route.useRouteContext()
  const canEdit = admin.role === 'OWNER'
  const [list, setList] = useState<Array<AdminProduct> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/products')
      .then(async (r) => (r.ok ? setList(await r.json()) : setError((await r.json().catch(() => ({}))).error ?? 'Could not load products.')))
      .catch(() => setError('Could not load products.'))
  }, [])

  const replace = (id: string, image: string, hasUpload: boolean) =>
    setList((l) => l?.map((p) => (p.id === id ? { ...p, image, hasUpload } : p)) ?? null)

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-6 md:py-8">
      <p className="label text-ink-3">Catalogue · live database</p>
      <h1 className="font-display text-4xl md:text-5xl mt-1">Products</h1>
      <p className="text-sm text-ink-2 mt-2 max-w-2xl">
        Prices and stock shown here are what the storefront and checkout use. Upload a product photo (JPEG, PNG, WebP or AVIF, up to {MAX_MB} MB); it replaces the
        bundled image everywhere. Editing prices and stock arrives with the catalogue milestone.
      </p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-oxblood-soft px-4 py-3 text-sm text-oxblood">{error}</p>}
      {!list && !error && <p className="mt-8 text-sm text-ink-3">Loading…</p>}
      {list && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <ProductRow key={p.id} product={p} canEdit={canEdit} onImage={replace} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({ product: p, canEdit, onImage }: { product: AdminProduct; canEdit: boolean; onImage: (id: string, image: string, hasUpload: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async (method: 'POST' | 'DELETE', file?: File) => {
    setError('')
    if (file && file.size > MAX_MB * 1024 * 1024) return setError(`That file is larger than ${MAX_MB} MB.`)
    setBusy(true)
    try {
      const body = file ? new FormData() : undefined
      if (file) body!.append('image', file)
      const res = await fetch(`/api/admin/products/${encodeURIComponent(p.id)}/image`, { method, body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Upload failed.')
      onImage(p.id, data.image, method === 'POST')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Panel className="p-4">
      <div className="flex gap-4">
        <img src={img(p.image, 192, 192)} alt="" width={96} height={96} className="size-24 rounded-xl object-cover bg-paper-2 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link to="/product/$slug" params={{ slug: p.slug }} className="font-display text-2xl leading-tight hover:text-verdigris">{p.name}</Link>
            <span className="flex gap-1.5 shrink-0">
              {p.isDemo && <span className="label rounded-full bg-amber-soft text-amber px-2 py-0.5">Demo</span>}
              {!p.active && <span className="label rounded-full bg-paper-2 text-ink-3 px-2 py-0.5">Hidden</span>}
            </span>
          </div>
          <ul className="mt-2 grid gap-1 text-xs">
            {p.variants.map((v) => (
              <li key={v.id} className="flex justify-between gap-2">
                <span className="text-ink-2">{v.name} <span className="font-mono text-ink-3">{v.sku}</span></span>
                <span>
                  {formatMoney(v.price)} · <span className={v.stock <= v.lowStockThreshold ? 'text-amber' : ''}>{v.stock} in stock</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => e.target.files?.[0] && send('POST', e.target.files[0])} />
          <button className="btn btn-ghost !py-1.5 !px-3 text-sm" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={14} /> {busy ? 'Saving…' : p.hasUpload ? 'Replace image' : 'Upload image'}
          </button>
          {p.hasUpload && (
            <button className="inline-flex items-center gap-1.5 text-ink-3 hover:text-oxblood" disabled={busy} onClick={() => send('DELETE')}>
              <ImageOff size={14} /> Use default image
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-oxblood">{error}</p>}
    </Panel>
  )
}
