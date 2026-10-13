import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, legalHead } from '@/components/store/LegalPage'

export const Route = createFileRoute('/_store/terms')({
  head: legalHead('terms'),
  component: () => <LegalPage slug="terms" />,
})
