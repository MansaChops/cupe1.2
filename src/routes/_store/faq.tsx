import { Link, createFileRoute } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { site } from '@/config/site'
import { faqs } from '@/data/content'

export const Route = createFileRoute('/_store/faq')({
  head: () => ({
    meta: [
      { title: `FAQ — ${site.name}` },
      { name: 'description', content: `Ordering, payment, delivery and packaging questions answered by ${site.name}.` },
    ],
  }),
  component: Faq,
})

function Faq() {
  return (
    <div className="mx-auto max-w-4xl px-5 pt-14">
      <p className="label text-ink-3 rise">Questions</p>
      <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-2 rise">Before you order</h1>
      <p className="mt-5 max-w-xl text-ink-2 rise" style={{ '--d': '80ms' } as React.CSSProperties}>
        How ordering, payment and delivery work. Can’t see your question? <Link to="/contact" className="underline">Get in touch</Link>.
      </p>
      <div className="mt-12 border-t border-line">
        {faqs.map((f) => (
          <details key={f.q} className="group border-b border-line py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
              {f.q}
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line font-mono text-ink-3 transition group-open:rotate-45 group-open:border-verdigris/50 group-open:text-verdigris">+</span>
            </summary>
            <p className="mt-3 text-ink-2 leading-relaxed max-w-2xl">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-14 flex flex-wrap gap-3">
        <Link to="/shipping" className="btn btn-ghost">Delivery policy</Link>
        <Link to="/refunds" className="btn btn-ghost">Refunds</Link>
        <a href={`mailto:${site.email}`} className="btn btn-primary"><Mail size={16} /> {site.email}</a>
      </div>
    </div>
  )
}
