import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Clock, Mail, MapPin } from 'lucide-react'
import { site } from '@/config/site'

export const Route = createFileRoute('/_store/contact')({
  head: () => ({ meta: [{ title: `Contact — ${site.name}` }, { name: 'description', content: `Get in touch with ${site.name} about an order or product.` }] }),
  component: Contact,
})

const encode = (data: Record<string, string>) =>
  Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

function Contact() {
  const [f, setF] = useState({ name: '', email: '', orderNumber: '', topic: 'Order', message: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const on = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [e.target.name]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch('/contact-form.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({ 'form-name': 'contact', ...f }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14 grid gap-14 md:grid-cols-[1fr_1.2fr]">
      <div className="rise">
        <p className="label text-ink-3">Contact</p>
        <h1 className="font-display text-5xl md:text-6xl mt-2">Talk to the person packing your order.</h1>
        <p className="mt-5 text-ink-2 max-w-md">We reply to every message within one working day. Quote your order number and we can help faster.</p>
        <ul className="mt-10 grid gap-5 text-sm">
          <li className="flex gap-3"><Mail size={18} className="text-ink-3" /> <a href={`mailto:${site.email}`} className="underline underline-offset-4">{site.email}</a></li>
          <li className="flex gap-3"><Clock size={18} className="text-ink-3" /> Monday–Friday, 9am–5pm</li>
          <li className="flex gap-3"><MapPin size={18} className="text-ink-3" /> {site.address}</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-card p-6 md:p-8 rise" style={{ '--d': '80ms' } as React.CSSProperties}>
        {state === 'sent' ? (
          <div className="py-16 text-center">
            <span className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-verdigris-soft text-verdigris"><Check /></span>
            <p className="font-display text-3xl mt-5">Message received</p>
            <p className="text-ink-2 mt-2">We’ll reply to {f.email} within one working day.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="form-name" value="contact" />
            <p hidden><label>Leave blank <input name="bot-field" /></label></p>
            <label className="grid gap-1.5"><span className="text-sm font-medium">Name</span><input required name="name" className="field" value={f.name} onChange={on} autoComplete="name" /></label>
            <label className="grid gap-1.5"><span className="text-sm font-medium">Email</span><input required type="email" name="email" className="field" value={f.email} onChange={on} autoComplete="email" /></label>
            <label className="grid gap-1.5"><span className="text-sm font-medium">Order number <span className="text-ink-3 font-normal">(optional)</span></span><input name="orderNumber" placeholder="CP-20261008-010027" className="field font-mono" value={f.orderNumber} onChange={on} /></label>
            <label className="grid gap-1.5"><span className="text-sm font-medium">Topic</span>
              <select name="topic" className="field" value={f.topic} onChange={on}>
                <option>Order</option><option>Delivery</option><option>Refund</option><option>Product question</option><option>Other</option>
              </select>
            </label>
            <label className="grid gap-1.5 sm:col-span-2"><span className="text-sm font-medium">Message</span><textarea required name="message" className="field min-h-36" value={f.message} onChange={on} maxLength={2000} /></label>
            {state === 'error' && <p className="sm:col-span-2 text-sm text-oxblood">That didn’t send. Please try again, or email us directly.</p>}
            <button className="btn btn-primary sm:col-span-2" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
