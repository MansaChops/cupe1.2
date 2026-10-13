import { useSyncExternalStore } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { clampQty, findVariantIn, unitPrice, type Product } from '@/lib/catalogue'
import { site } from '@/config/site'

/**
 * Persistent basket. Only variant IDs and quantities are stored in the browser. Names, prices
 * and stock come from the catalogue the server loaded from the database (the `/_store` route
 * loader), and the server re-prices and re-checks everything when the order is placed.
 */
export type CartLine = { variantId: string; quantity: number }

const KEY = 'cumbria.cart.v1'
const listeners = new Set<() => void>()
let lines: Array<CartLine> = []
let loaded = false
// Latest server catalogue, used to snap quantities to what can be bought. Empty until loaded,
// in which case quantities are kept as they are.
let catalogue: Array<Product> = []

const load = () => {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    lines = JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    lines = []
  }
}

const commit = (next: Array<CartLine>) => {
  lines = next
    .map((l) => {
      if (!catalogue.length) return l
      const found = findVariantIn(catalogue, l.variantId)
      return { ...l, quantity: found ? clampQty(found.variant, l.quantity) : 0 }
    })
    .filter((l) => l.quantity > 0)
  localStorage.setItem(KEY, JSON.stringify(lines))
  listeners.forEach((fn) => fn())
}

const EMPTY: Array<CartLine> = []
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => {
  load()
  return lines
}

export const cart = {
  add(variantId: string, quantity = 1) {
    load()
    const existing = lines.find((l) => l.variantId === variantId)
    commit(
      existing
        ? lines.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l))
        : [...lines, { variantId, quantity }],
    )
  },
  set(variantId: string, quantity: number) {
    load()
    commit(lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)))
  },
  remove(variantId: string) {
    load()
    commit(lines.filter((l) => l.variantId !== variantId))
  },
  clear() {
    commit([])
  },
}

const storeRoute = getRouteApi('/_store')

/** The server-loaded catalogue (active products and variants, current prices and stock). */
export const useCatalogue = (): Array<Product> => storeRoute.useLoaderData()

export function useCart() {
  const products = useCatalogue()
  catalogue = products
  const raw = useSyncExternalStore(subscribe, snapshot, () => EMPTY)
  const items = raw.flatMap((line) => {
    const found = findVariantIn(products, line.variantId)
    if (!found) return []
    const price = unitPrice(found.variant)
    return [{ ...line, ...found, price, lineTotal: price * line.quantity }]
  })
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const shipping = subtotal === 0 || subtotal >= site.shipping.freeOver ? 0 : site.shipping.standard
  const count = items.reduce((s, i) => s + i.quantity, 0)
  return { items, subtotal, shipping, total: subtotal + shipping, count }
}
