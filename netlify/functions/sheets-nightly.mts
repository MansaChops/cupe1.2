import type { Config } from '@netlify/functions'
import { sheetsConfigured, syncSheets } from '../lib/sheets.js'

// Nightly full rebuild of the Google Sheets report, so it stays current even if an
// individual sync was skipped (e.g. stock edits, which don't create order events).
export default async () => {
  if (!sheetsConfigured()) return
  try {
    console.log('[sheets-nightly]', await syncSheets())
  } catch (err) {
    console.error('[sheets-nightly] sync failed', err)
  }
}

export const config: Config = { schedule: '15 2 * * *' }
