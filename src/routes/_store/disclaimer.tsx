import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, legalHead } from '@/components/store/LegalPage'

export const Route = createFileRoute('/_store/disclaimer')({
  head: legalHead('disclaimer'),
  component: () => <LegalPage slug="disclaimer" />,
})
