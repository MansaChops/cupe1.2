import type { Config } from '@netlify/functions'
import { deliver, dueNotifications } from '../lib/outbox.js'

// Delivers queued notifications (Slack, invoice/status emails, Google Sheets) that weren't sent
// on the first try, following the outbox backoff.
export default async () => {
  for (const { id } of await dueNotifications()) await deliver(id)
}

export const config: Config = { schedule: '* * * * *' }
