/**
 * @param {string} text
 * @returns {'en'|'vi'}
 */
export function detectMessageLanguage(text) {
  const s = String(text || '').trim()
  if (!s) return 'vi'
  if (
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu.test(
      s,
    )
  ) {
    return 'vi'
  }
  return 'en'
}

export function resolveReplyLanguage(message, preferred) {
  if (preferred === 'en' || preferred === 'vi') return preferred
  return detectMessageLanguage(message)
}
