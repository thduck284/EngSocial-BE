import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

// Try .env first; if missing or error, load .env.example (example values only)
const r = dotenv.config({ path: path.join(root, '.env') })
if (r.error) {
  dotenv.config({ path: path.join(root, '.env.example') })
}
