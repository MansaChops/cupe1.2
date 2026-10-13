import { site } from '@/config/site'
import { legalPages, type LegalSlug } from '@/data/content'

export const legalHead = (slug: LegalSlug) => () => {
  const page = legalPages.find((p) => p.slug === slug)!
  return { meta: [{ title: `${page.title} — ${site.name}` }, { name: 'description', content: page.intro }] }
}

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const page = legalPages.find((p) => p.slug === slug)!
  return (
    <article className="mx-auto max-w-3xl px-5 pt-14">
      <p className="label text-ink-3">Policies · Last updated 7 October 2026</p>
      <h1 className="font-display text-5xl md:text-6xl mt-3">{page.title}</h1>
      <p className="mt-4 text-lg text-ink-2">{page.intro}</p>
      <div className="mt-12 grid gap-10">
        {page.sections.map(([heading, body], i) => (
          <section key={heading} className="grid gap-2 md:grid-cols-[3rem_1fr]">
            <span className="font-mono text-sm text-ink-3 pt-1">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h2 className="font-display text-2xl">{heading}</h2>
              <p className="mt-2 leading-relaxed text-ink-2">{body}</p>
            </div>
          </section>
        ))}
      </div>
      <p className="mt-14 rounded-xl bg-amber-soft px-5 py-4 text-sm text-ink-2">
        Questions about this policy? Email <a className="underline" href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </article>
  )
}
