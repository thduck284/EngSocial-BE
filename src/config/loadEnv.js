import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

const envPath = path.join(root, '.env')

if (!fs.existsSync(envPath)) {
  console.warn(`[EngSocial-BE] .env not found at ${envPath}, using process.env`)
} else {
  const r = dotenv.config({ path: envPath })
  if (r.error) {
    console.error('[EngSocial-BE] Failed to load .env:', r.error.message)
    throw new Error(`[EngSocial-BE] Invalid .env: ${r.error.message}`)
  }
}
