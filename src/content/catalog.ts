import rawCatalog from './catalog.json'

export const sectionIds = ['definition', 'concept', 'examples', 'syntax'] as const
export type SectionId = (typeof sectionIds)[number]

export type ContentBlock =
  | { kind: 'text'; text: string }
  | { kind: 'sql'; code: string; dialect?: string }
  | { kind: 'table'; columns: string[]; rows: string[][] }

export interface Topic {
  id: string
  title: string
  order: number
}

export interface Flashcard {
  id: string
  topicId: string
  title: string
  order: number
  question: string
  answer: string
  sections: Record<SectionId, ContentBlock[]>
  syllabusIds: string[]
  references: { title: string; url: string }[]
  diagram?: { asset: 'left-join' | 'inner-join'; alt: string }
}

export interface Catalog {
  schemaVersion: 1
  contentVersion: string
  topics: Topic[]
  cards: Flashcard[]
}

function invalid(path: string): never {
  throw new Error(`Invalid learning content: ${path}`)
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid(path)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) return invalid(path)
  return value
}

function id(value: unknown, path: string): string {
  const result = text(value, path)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) return invalid(path)
  return result
}

function order(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    return invalid(path)
  }
  return value
}

function list(value: unknown, path: string, nonempty = false): unknown[] {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) return invalid(path)
  return value
}

function block(value: unknown, path: string): ContentBlock {
  const entry = object(value, path)
  switch (entry.kind) {
    case 'text':
      return { kind: 'text', text: text(entry.text, `${path}.text`) }
    case 'sql': {
      const result: ContentBlock = { kind: 'sql', code: text(entry.code, `${path}.code`) }
      if ('dialect' in entry) result.dialect = text(entry.dialect, `${path}.dialect`)
      return result
    }
    case 'table': {
      const columns = list(entry.columns, `${path}.columns`, true).map((column) =>
        text(column, `${path}.columns`),
      )
      const rows = list(entry.rows, `${path}.rows`).map((row) => {
        const cells = list(row, `${path}.rows`)
        if (cells.length !== columns.length || cells.some((cell) => typeof cell !== 'string')) {
          return invalid(`${path}.rows`)
        }
        return cells as string[]
      })
      return { kind: 'table', columns, rows }
    }
    default:
      return invalid(`${path}.kind`)
  }
}

function uniqueIds(entries: { id: string }[], path: string): void {
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) invalid(path)
}

function byOrder(a: { order: number; id: string }, b: { order: number; id: string }): number {
  return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Parse unknown JSON before any learning screen consumes it. Nothing is silently omitted. */
export function validateCatalog(input: unknown): Catalog {
  const root = object(input, 'catalog')
  if (root.schemaVersion !== 1) invalid('schemaVersion')
  const contentVersion = text(root.contentVersion, 'contentVersion')
  const topics = list(root.topics, 'topics').map((value, index): Topic => {
    const path = `topics[${index}]`
    const topic = object(value, path)
    return {
      id: id(topic.id, `${path}.id`),
      title: text(topic.title, `${path}.title`),
      order: order(topic.order, `${path}.order`),
    }
  })
  uniqueIds(topics, 'duplicate topic IDs')
  const topicIds = new Set(topics.map((topic) => topic.id))
  const cards = list(root.cards, 'cards').map((value, index): Flashcard => {
    const path = `cards[${index}]`
    const card = object(value, path)
    const topicId = id(card.topicId, `${path}.topicId`)
    if (!topicIds.has(topicId)) invalid(`${path}.topicId`)
    const sections = object(card.sections, `${path}.sections`)
    if (Object.keys(sections).some((key) => !sectionIds.some((section) => section === key))) {
      invalid(`${path}.sections`)
    }
    const readSection = (section: SectionId) =>
      list(sections[section], `${path}.${section}`, true).map((value, index) =>
        block(value, `${path}.${section}[${index}]`),
      )
    const syllabusIds = list(card.syllabusIds, `${path}.syllabusIds`, true).map((value) => {
      const syllabusId = text(value, `${path}.syllabusIds`)
      if (!/^SQL-(0[1-9]|1[0-4])\.(0[1-9]|[1-9][0-9])$/.test(syllabusId)) {
        invalid(`${path}.syllabusIds`)
      }
      return syllabusId
    })
    if (new Set(syllabusIds).size !== syllabusIds.length) invalid(`${path}.syllabusIds`)
    const references = list(card.references, `${path}.references`, true).map((value) => {
      const reference = object(value, `${path}.references`)
      const title = text(reference.title, `${path}.references.title`)
      const url = text(reference.url, `${path}.references.url`)
      try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
          invalid(`${path}.references.url`)
        }
      } catch {
        invalid(`${path}.references.url`)
      }
      return { title, url }
    })
    const result: Flashcard = {
      id: id(card.id, `${path}.id`),
      topicId,
      title: text(card.title, `${path}.title`),
      order: order(card.order, `${path}.order`),
      question: text(card.question, `${path}.question`),
      answer: text(card.answer, `${path}.answer`),
      sections: {
        definition: readSection('definition'),
        concept: readSection('concept'),
        examples: readSection('examples'),
        syntax: readSection('syntax'),
      },
      syllabusIds,
      references,
    }
    if ('diagram' in card) {
      const diagram = object(card.diagram, `${path}.diagram`)
      if (diagram.asset !== 'left-join' && diagram.asset !== 'inner-join') {
        invalid(`${path}.diagram.asset`)
      }
      result.diagram = { asset: diagram.asset, alt: text(diagram.alt, `${path}.diagram.alt`) }
    }
    return result
  })
  uniqueIds(cards, 'duplicate card IDs')
  return { schemaVersion: 1, contentVersion, topics: topics.sort(byOrder), cards: cards.sort(byOrder) }
}

export function loadCatalog(): Catalog {
  return validateCatalog(rawCatalog)
}
