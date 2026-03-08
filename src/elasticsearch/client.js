import { Client } from '@elastic/elasticsearch'

const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || process.env.ELASTICSEARCH_URL || 'http://localhost:9200'

let client = null

export function isElasticsearchEnabled() {
  return Boolean(process.env.ELASTICSEARCH_NODE || process.env.ELASTICSEARCH_URL)
}

/**
 * @returns {import('@elastic/elasticsearch').Client | null}
 */
export function getElasticsearchClient() {
  if (!isElasticsearchEnabled()) return null
  if (client) return client
  try {
    client = new Client({
      node: ELASTICSEARCH_NODE,
    })
    return client
  } catch (err) {
    console.warn('Elasticsearch client init failed:', err?.message)
    return null
  }
}
