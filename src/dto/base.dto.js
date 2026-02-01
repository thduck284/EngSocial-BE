/**
 * Base DTO class
 */
export class BaseDTO {
  constructor(data) {
    Object.assign(this, data)
  }

  toJSON() {
    return { ...this }
  }
}

/**
 * Remove null/undefined fields from object
 */
export const removeEmpty = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  )
}
