import { getElasticsearchClient } from './client.js'
import { USERS_INDEX, ensureUsersIndex } from './indices.js'

/**
 * Index a user for search (id, name, email, updatedAt).
 * @param {{ id: string, name: string, email?: string, updatedAt?: Date }} user
 */
export async function indexUser(user) {
  const es = getElasticsearchClient()
  if (!es) return
  try {
    await es.index({
      index: USERS_INDEX,
      id: user.id,
      document: {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        updatedAt: user.updatedAt || new Date(),
      },
      refresh: false,
    })
  } catch (err) {
    console.warn('Elasticsearch indexUser failed:', err?.message)
  }
}

/**
 * Remove user from index (e.g. account deleted).
 * @param {string} userId
 */
export async function deleteUserFromIndex(userId) {
  const es = getElasticsearchClient()
  if (!es) return
  try {
    await es.delete({ index: USERS_INDEX, id: userId, refresh: false })
  } catch (err) {
    if (err?.meta?.statusCode !== 404) console.warn('Elasticsearch deleteUser failed:', err?.message)
  }
}

/**
 * Full-text search users by name. Returns list of { id, score } sorted by relevance.
 * @param {string} q - search query
 * @param {{ from?: number, size?: number }} opts - pagination
 * @returns {{ ids: string[], total: number }}
 */
export async function searchUserIds(q, { from = 0, size = 20 } = {}) {
  const es = getElasticsearchClient()
  if (!es) return { ids: [], total: 0 }
  const trimmed = (q || '').trim()
  try {
    const query = trimmed
      ? {
          multi_match: {
            query: trimmed,
            fields: ['name'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        }
      : { match_all: {} }
    const res = await es.search({
      index: USERS_INDEX,
      from,
      size,
      query,
      sort: trimmed ? [{ _score: 'desc' }, { 'name.keyword': 'asc' }] : [{ 'name.keyword': 'asc' }],
      _source: false,
    })
    const total = typeof res.hits.total === 'number' ? res.hits.total : res.hits.total?.value ?? 0
    const ids = res.hits.hits.map((h) => h._id)
    return { ids, total }
  } catch (err) {
    console.warn('Elasticsearch searchUserIds failed:', err?.message)
    return { ids: [], total: 0 }
  }
}

/**
 * Ensure index exists (call on startup). Optionally sync all users from MongoDB.
 * @param {() => Promise<Array<{ _id: any, name: string, email?: string, updatedAt?: Date }>>} fetchAllUsers
 */
export async function initUserSearch(fetchAllUsers) {
  const es = getElasticsearchClient()
  if (!es) return
  await ensureUsersIndex(es)
  if (typeof fetchAllUsers === 'function') {
    try {
      const users = await fetchAllUsers()
      for (const u of users) {
        const id = u._id?.toString?.() || u.id
        if (id) await indexUser({ id, name: u.name, email: u.email, updatedAt: u.updatedAt })
      }
      console.log(`Elasticsearch: indexed ${users.length} users`)
    } catch (err) {
      console.warn('Elasticsearch initUserSearch sync failed:', err?.message)
    }
  }
}
