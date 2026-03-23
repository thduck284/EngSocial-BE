import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

// Load environment only from `.env` (no `.env.example` fallback).
// If `.env` is missing or invalid, we let the app fail fast with a clear error.
const r = dotenv.config({ path: path.join(root, '.env') })
if (r.error) {
  // eslint-disable-next-line no-console
  console.error('[EngSocial-BE] Failed to load .env:', r.error.message)
  throw new Error(`[EngSocial-BE] Missing/invalid .env: ${r.error.message}`)
}
