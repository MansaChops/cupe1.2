import { Suspense, lazy, useEffect, useState } from 'react'
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { site } from '@/config/site'

import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: `${site.name} — ${site.tagline}` },
      { name: 'description', content: site.description },
      { property: 'og:title', content: site.name },
      { property: 'og:description', content: site.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/.netlify/images?url=/img/hero.png&w=1200&h=630&fit=cover&fm=jpg' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'theme-color', content: '#0a0d0e' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <HeadContent />
      </head>
      <body className="grain min-h-screen">
        {children}
        <ManagementGate />
        <Scripts />
      </body>
    </html>
  )
}

// Hidden management sign-in. Nothing links to it: it opens at /#management, or when a Netlify
// Identity email link (invite, password reset) lands on the site with a token in the hash.
const ManagementLogin = lazy(() => import('@/components/admin/ManagementLogin').then((m) => ({ default: m.ManagementLogin })))
const isManagementHash = (hash: string) => hash === '#management' || /(invite|recovery|confirmation|email_change)_token=/.test(hash)

function ManagementGate() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const check = () => setOpen(isManagementHash(location.hash))
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])
  if (!open) return null
  const close = () => {
    history.replaceState(null, '', location.pathname + location.search)
    setOpen(false)
  }
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[100] bg-paper" />}>
      <ManagementLogin onClose={close} />
    </Suspense>
  )
}

export function StatusPage({ code, title, body }: { code: string; title: string; body: string }) {
  return (
    <main className="min-h-[70vh] grid place-items-center px-6 py-24">
      <div className="max-w-md text-center rise">
        <p className="label text-ink-3 mb-6">{code}</p>
        <h1 className="font-display text-5xl mb-4">{title}</h1>
        <p className="text-ink-2 mb-10">{body}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="btn btn-primary">Back to home</Link>
          <Link to="/contact" className="btn btn-ghost">Contact us</Link>
        </div>
      </div>
    </main>
  )
}

function NotFound() {
  return (
    <StatusPage
      code="Error 404"
      title="This page isn’t on the shelf"
      body="The link may be out of date, or the product may no longer be listed."
    />
  )
}

function ErrorPage() {
  return (
    <StatusPage
      code="Error 500"
      title="Something went wrong on our side"
      body="Nothing has been charged. Please try again in a moment — if it keeps happening, get in touch and we’ll sort it."
    />
  )
}
