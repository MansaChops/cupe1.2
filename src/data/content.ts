/**
 * Editable site content. In a later milestone these become rows the owner edits from
 * /admin/settings; for now they live here as clearly-marked drafts.
 *
 * Legal copy below is a structural placeholder only — it is NOT legal advice and must be
 * replaced with wording approved by a UK solicitor/regulatory adviser before launch.
 */
import { site } from '@/config/site'

export const home = {
  eyebrow: 'UK peptide supply · Est. 2026',
  heading: 'Sealed, labelled and packed by hand.',
  sub: `${site.name} keeps a small, carefully stored range and packs every order ourselves — checked against the order, sealed, and sent tracked from Cumbria.`,
  cta: 'Shop products',
}

export const reasons = [
  {
    k: '01',
    title: 'Packed by a person, not a warehouse',
    body: 'Each order is picked and checked line by line against a printed packing slip before the box is sealed.',
  },
  {
    k: '02',
    title: 'Batch-labelled stock',
    body: 'Every vial carries a SKU and batch reference, so what you ordered is exactly what arrives.',
  },
  {
    k: '03',
    title: 'Tracked UK delivery',
    body: `Orders placed before ${site.shipping.dispatchCutoff} on a working day go out the same afternoon, tracked end to end.`,
  },
  {
    k: '04',
    title: 'Pay by invoice',
    body: 'No card details are taken on this website. Every order is emailed an invoice with our payment details, and we dispatch as soon as payment arrives.',
  },
]

export const faqs = [
  {
    q: 'When will my order be dispatched?',
    a: `Orders paid before ${site.shipping.dispatchCutoff} Monday to Friday are packed and dispatched the same day. Later orders go out the next working day.`,
  },
  {
    q: 'How do I pay?',
    a: 'We don’t take payments on the website. When you place an order you’re emailed an invoice with our payment details straight away. Use your order number (e.g. ORD-10027) as the payment reference and we’ll dispatch as soon as it arrives.',
  },
  {
    q: 'How is my order packaged?',
    a: 'Vials are packed in a protective insert inside a plain, unbranded mailer. Nothing on the outside describes the contents.',
  },
  {
    q: 'Can I change or cancel my order?',
    a: 'Yes, as long as it hasn’t been packed. Contact us with your order number (e.g. ORD-10027) and we’ll update it or refund you in full.',
  },
  {
    q: 'Do I need an account to order?',
    a: 'No. Guest checkout is available. You’ll receive your order number by email so you can contact us about it at any time.',
  },
  {
    q: 'Can I use a discount code?',
    a: 'Yes. Enter it in the “Discount code” box at checkout and the discount is shown before you place your order. One code per order.',
  },
  {
    q: 'I haven’t received my invoice',
    a: 'Check your spam or junk folder first. If it isn’t there, contact us with your order number and we’ll resend it.',
  },
]

const draft = `This page is a draft placeholder. Replace this text with wording approved by your legal adviser before the shop goes live. It is editable from Admin → Settings → Pages.`

export const legalPages = [
  {
    slug: 'shipping',
    title: 'Delivery',
    intro: 'How and when your order reaches you.',
    sections: [
      ['Dispatch times', `Orders paid before ${site.shipping.dispatchCutoff} on a working day are dispatched the same day. Weekend and bank-holiday orders are dispatched on the next working day.`],
      ['Delivery options', `UK tracked delivery: £${site.shipping.standard.toFixed(2)}, free on orders over £${site.shipping.freeOver}. Estimated delivery: ${site.shipping.estimate}.`],
      ['Pre-order items', `Ipamorelin, CJC-1295 (no DAC), Selank, Semax and Epitalon are pre-order only. They are not held in stock and do not follow the same-day dispatch times above. ${site.shipping.preOrderEstimate} If your order also contains in-stock items, those are dispatched as normal and the pre-order items follow separately.`],
      ['Tracking', 'You will receive a tracking number by email as soon as your order is marked as shipped.'],
      ['International orders', draft],
    ],
  },
  {
    slug: 'refunds',
    title: 'Refund policy',
    intro: 'Cancellations, returns and refunds.',
    sections: [
      ['Before dispatch', 'Orders can be cancelled for a full refund at any time before they are packed.'],
      ['Damaged or incorrect items', 'If anything arrives damaged or incorrect, contact us within 14 days with your order number and photos.'],
      ['Returns', draft],
      ['Refund timings', 'Refunds are paid back to the account you paid from, usually within 5 working days.'],
    ],
  },
  {
    slug: 'terms',
    title: 'Terms & conditions',
    intro: `The terms on which ${site.legalName} supplies products.`,
    sections: [
      ['About us', `${site.legalName}, ${site.address}.`],
      ['Eligibility', 'You must be 18 or over to place an order.'],
      ['Orders and contract', draft],
      ['Pricing and payment', 'Prices are shown in pounds sterling. No payment is taken on the website: each order is invoiced by email and is dispatched once payment has been received.'],
      ['Liability', draft],
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    intro: 'What we collect, why, and your rights under UK GDPR.',
    sections: [
      ['What we collect', 'Your name, email, phone number and delivery address — only what we need to fulfil and support your order. We never ask for or store card details.'],
      ['Who we share it with', 'Our delivery carrier (address only), our email provider (invoices and order updates), and our internal order tools (Slack and Google Sheets).'],
      ['How long we keep it', draft],
      ['Your rights', `You can ask us for a copy of your data, or for it to be deleted, by emailing ${site.email}.`],
      ['Cookies', 'We use essential storage to remember your basket. We do not use advertising cookies.'],
    ],
  },
  {
    slug: 'disclaimer',
    title: 'Product disclaimer',
    intro: 'Please read before ordering.',
    sections: [
      ['Product information', 'Product descriptions on this site describe the physical product and its storage only. We make no claims about the effects of any product.'],
      ['Age restriction', 'Products are sold only to customers aged 18 and over.'],
      ['Regulatory status', draft],
    ],
  },
] as const

export type LegalSlug = (typeof legalPages)[number]['slug']
