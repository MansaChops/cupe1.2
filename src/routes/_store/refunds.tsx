import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, legalHead } from '@/components/store/LegalPage'

export const Route = createFileRoute('/_store/refunds')({
  head: legalHead('refunds'),
  component: () => <LegalPage slug="refunds" />,
})
