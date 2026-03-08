export const USERS_INDEX = 'engsocial-users'

/**
 * Ensure users index exists with mapping for search (name full-text, name.keyword for exact/sort).
 * @param {import('@elastic/elasticsearch').Client} es
 */
export async function ensureUsersIndex(es) {
  if (!es) return
  try {
    const exists = await es.indices.exists({ index: USERS_INDEX })
    if (exists) return
    await es.indices.create({
      index: USERS_INDEX,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          email: { type: 'keyword', index: false },
          updatedAt: { type: 'date' },
        },
      },
    })
    console.log(`Elasticsearch: index "${USERS_INDEX}" created`)
  } catch (err) {
    console.warn('Elasticsearch ensureUsersIndex failed:', err?.message)
  }
}
