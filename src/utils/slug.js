/**
 * Generate URL-friendly slug from string
 */
export const generateSlug = (str) => {
  return str
    .toLowerCase()
    .normalize('NFD') // Normalize Unicode
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[đĐ]/g, 'd') // Replace Vietnamese đ
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Replace multiple - with single -
}

/**
 * Generate unique slug with timestamp
 */
export const generateUniqueSlug = (str) => {
  const baseSlug = generateSlug(str)
  const timestamp = Date.now().toString(36)
  return `${baseSlug}-${timestamp}`
}
