import { Link, createFileRoute } from '@tanstack/react-router'
import { img, site } from '@/config/site'

export const Route = createFileRoute('/_store/about')({
  head: () => ({ meta: [{ title: `About — ${site.name}` }, { name: 'description', content: site.description }] }),
  component: About,
})

const steps = [
  ['Order received', 'Your order gets its own number and your invoice is emailed straight away.'],
  ['Picked & checked', 'Each line is picked from stock and checked against a printed packing slip.'],
  ['Sealed', 'Vials go into a protective insert inside a plain, unbranded mailer.'],
  ['Dispatched tracked', 'Handed to Royal Mail the same afternoon, with tracking emailed to you.'],
]

function About() {
  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-end">
        <h1 className="font-display text-5xl md:text-7xl leading-[0.95] rise">
          One room, one bench, <em>every order checked by hand.</em>
        </h1>
        <p className="text-ink-2 leading-relaxed rise" style={{ '--d': '100ms' } as React.CSSProperties}>
          {site.name} is a small UK business. We don’t use a fulfilment warehouse — every order is packed by us, at our own bench,
          from stock we receive, log and store ourselves.
        </p>
      </div>
      <img src={img('packing.png', 1600, 700)} alt="Our packing bench" loading="lazy" className="media-tone mt-14 w-full rounded-[1.25rem] border border-line aspect-[16/7] object-cover" />
      <ol className="mt-16 grid gap-px bg-line md:grid-cols-4 rounded-2xl overflow-hidden border border-line">
        {steps.map(([t, b], i) => (
          <li key={t} className="bg-card p-6">
            <span className="font-mono text-sm text-verdigris">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="font-display text-2xl mt-3">{t}</h2>
            <p className="text-sm text-ink-2 mt-2">{b}</p>
          </li>
        ))}
      </ol>
      <div className="mt-16 text-center">
        <Link to="/shop" className="btn btn-primary">Shop products</Link>
      </div>
    </div>
  )
}
