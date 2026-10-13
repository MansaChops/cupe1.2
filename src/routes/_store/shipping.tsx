import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, legalHead } from '@/components/store/LegalPage'

export const Route = createFileRoute('/_store/shipping')({
  head: legalHead('shipping'),
  component: () => <LegalPage slug="shipping" />,
})
