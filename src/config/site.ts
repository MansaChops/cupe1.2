// Business identity. Change it here and it updates across the storefront, admin, metadata and
// packing slip. Phone number and address are still placeholders.
export const site = {
  name: 'Cumbria Peptides',
  legalName: 'Cumbria Peptides',
  logo: 'logo.png',
  logoMark: 'logo-mark.png',
  tagline: 'Peptide supply, packed by hand in the UK.',
  description:
    'Cumbria Peptides is a UK peptide supplier. Every order is checked, packed and dispatched by hand from our own premises.',
  email: 'cumbriapeptides@gmail.com',
  phone: '+44 20 0000 0000',
  address: 'Unit 4, Example Yard, Carlisle, Cumbria CA1 0AA',
  currency: 'GBP',
  locale: 'en-GB',
  shipping: {
    standard: 4.99,
    freeOver: 120,
    dispatchCutoff: '3pm',
    estimate: '1–3 working days (Royal Mail Tracked 48)',
    // Pre-order products are not held in stock and ship on their own, later timeline.
    preOrderEstimate: 'Dispatched separately once the next batch arrives. We’ll email you when it ships.',
  },
} as const

export const formatMoney = (value: number) =>
  new Intl.NumberFormat(site.locale, {
    style: 'currency',
    currency: site.currency,
  }).format(value)

/**
 * Image CDN URL. `file` is either a bundled image in public/img ("bpc-157.png") or a site path
 * ("/media/products/…", an uploaded image served from Netlify Blobs). Either way the Image CDN
 * fetches it from this site, then resizes and converts it.
 */
export const img = (file: string, w: number, h?: number) =>
  `/.netlify/images?url=${encodeURIComponent(file.startsWith('/') ? file : `/img/${file}`)}&w=${w}${h ? `&h=${h}&fit=cover` : ''}&fm=webp`
