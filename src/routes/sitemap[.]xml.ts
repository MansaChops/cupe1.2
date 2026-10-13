import { createFileRoute } from '@tanstack/react-router'
// Loads TanStack Start's typings for server route handlers (the `server` option below).
import type {} from '@tanstack/react-start'
import { getCatalogue } from '@/server/catalogue'

const pages = ['', 'shop', 'about', 'faq', 'contact', 'shipping', 'refunds', 'terms', 'privacy', 'disclaimer']

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const products = await getCatalogue()
        const urls = [...pages.map((p) => `/${p}`), ...products.map((p) => `/product/${p.slug}`)]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${origin}${u}</loc></url>`)
          .join('\n')}\n</urlset>`
        return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } })
      },
    },
  },
})
