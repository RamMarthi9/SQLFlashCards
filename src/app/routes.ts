import type { Catalog, Flashcard, Topic } from '../content/catalog'

export function cardHref(card: Flashcard): string {
  return `#/topics/${card.topicId}/cards/${card.id}`
}
type Route = { kind: 'topics' }
  | { kind: 'card'; topic: Topic; card: Flashcard; cards: Flashcard[] }
  | { kind: 'missing' }

export function resolveRoute(hash: string, catalog: Catalog): Route {
  if (!hash || hash === '#/topics') return { kind: 'topics' }
  const match = /^#\/topics\/([a-z0-9-]+)\/cards\/([a-z0-9-]+)$/.exec(hash)
  if (!match) return { kind: 'missing' }
  const topic = catalog.topics.find((item) => item.id === match[1])
  const card = catalog.cards.find((item) => item.id === match[2] && item.topicId === topic?.id)
  if (!topic || !card) return { kind: 'missing' }
  return { kind: 'card', topic, card, cards: catalog.cards.filter((item) => item.topicId === topic.id) }
}
