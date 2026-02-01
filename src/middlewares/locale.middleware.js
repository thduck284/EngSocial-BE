/**
 * Locale middleware - read Accept-Language from request and set req.language
 * Frontend sends Accept-Language: vi | en. Default: vi.
 */
const SUPPORTED = ['vi', 'en']
const DEFAULT = 'vi'

export const locale = (req, res, next) => {
  const raw =
    req.headers['accept-language'] ||
    req.headers['Accept-Language'] ||
    req.headers['x-language'] ||
    ''
  // Header can be "vi" or "en" or "vi,en;q=0.9" - take first valid code
  const code = raw.split(',')[0]?.trim().toLowerCase().slice(0, 2) || ''
  req.language = SUPPORTED.includes(code) ? code : DEFAULT
  next()
}
