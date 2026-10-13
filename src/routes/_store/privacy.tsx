import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, legalHead } from '@/components/store/LegalPage'

export const Route = createFileRoute('/_store/privacy')({
  head: legalHead('privacy'),
  component: () => <LegalPage slug="privacy" />,
})
