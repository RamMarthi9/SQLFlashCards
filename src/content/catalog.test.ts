// @vitest-environment node
/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import rawCatalog from './catalog.json'
import { loadCatalog, validateCatalog } from './catalog'

function draft(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(rawCatalog)) as Record<string, unknown>
}

function firstCard(catalog: Record<string, unknown>): Record<string, unknown> {
  return (catalog.cards as Record<string, unknown>[])[0]!
}

describe('learning content boundary', () => {
  it('loads the real collection with all syllabus topics and six complete starter cards', () => {
    const catalog = loadCatalog()
    expect(catalog.topics).toHaveLength(14)
    expect(catalog.cards).toHaveLength(6)
    expect(new Set(catalog.cards.map((card) => card.topicId))).toEqual(
      new Set(['basic-queries', 'filtering', 'joins']),
    )
    expect(catalog.cards.find((card) => card.id === 'joins-left-basic')?.syllabusIds)
      .toContain('SQL-07.03')
  })

  it('supports empty catalogs and topics without cards', () => {
    expect(validateCatalog({ schemaVersion: 1, contentVersion: 'empty', topics: [], cards: [] }).cards)
      .toEqual([])
    const catalog = draft()
    catalog.cards = []
    expect(validateCatalog(catalog).topics).toHaveLength(14)
  })

  it('sorts deterministically without mutating input', () => {
    const catalog = draft()
    const topics = catalog.topics as Record<string, unknown>[]
    topics.reverse()
    const before = JSON.stringify(catalog)
    expect(validateCatalog(catalog).topics[0]?.id).toBe('database-fundamentals')
    expect(JSON.stringify(catalog)).toBe(before)
  })

  it.each([null, [], 'catalog', 1])('rejects a non-object catalog: %j', (value) => {
    expect(() => validateCatalog(value)).toThrow('Invalid learning content')
  })

  it.each([
    ['unsupported schema', (catalog: Record<string, unknown>) => { catalog.schemaVersion = 2 }],
    ['missing version', (catalog: Record<string, unknown>) => { catalog.contentVersion = '' }],
    ['non-array topics', (catalog: Record<string, unknown>) => { catalog.topics = {} }],
    ['duplicate topic IDs', (catalog: Record<string, unknown>) => {
      const topics = catalog.topics as unknown[]
      topics.push(topics[0])
    }],
    ['duplicate card IDs', (catalog: Record<string, unknown>) => {
      const cards = catalog.cards as unknown[]
      cards.push(cards[0])
    }],
    ['missing topic', (catalog: Record<string, unknown>) => { firstCard(catalog).topicId = 'missing' }],
    ['unsafe route ID', (catalog: Record<string, unknown>) => { firstCard(catalog).id = '../other' }],
    ['blank question', (catalog: Record<string, unknown>) => { firstCard(catalog).question = ' ' }],
    ['wrong answer type', (catalog: Record<string, unknown>) => { firstCard(catalog).answer = 42 }],
    ['invalid order', (catalog: Record<string, unknown>) => { firstCard(catalog).order = 0.5 }],
    ['unknown section', (catalog: Record<string, unknown>) => {
      const sections = firstCard(catalog).sections as Record<string, unknown>
      sections.unknown = []
    }],
    ['missing section', (catalog: Record<string, unknown>) => {
      const sections = firstCard(catalog).sections as Record<string, unknown>
      delete sections.syntax
    }],
    ['empty section', (catalog: Record<string, unknown>) => {
      const sections = firstCard(catalog).sections as Record<string, unknown>
      sections.definition = []
    }],
    ['unsupported block', (catalog: Record<string, unknown>) => {
      const sections = firstCard(catalog).sections as Record<string, unknown>
      sections.definition = [{ kind: 'html', html: '<b>hello</b>' }]
    }],
    ['blank dialect label', (catalog: Record<string, unknown>) => {
      const sections = firstCard(catalog).sections as Record<string, unknown>
      sections.syntax = [{ kind: 'sql', code: 'SELECT 1;', dialect: ' ' }]
    }],
    ['table width mismatch', (catalog: Record<string, unknown>) => {
      const sections = firstCard(catalog).sections as Record<string, unknown>
      sections.examples = [{ kind: 'table', columns: ['Name', 'Salary'], rows: [['Asha']] }]
    }],
    ['unknown diagram', (catalog: Record<string, unknown>) => {
      firstCard(catalog).diagram = { asset: 'https://example.com/track.svg', alt: 'diagram' }
    }],
    ['blank diagram alternative', (catalog: Record<string, unknown>) => {
      firstCard(catalog).diagram = { asset: 'left-join', alt: '' }
    }],
    ['invalid syllabus ID', (catalog: Record<string, unknown>) => {
      firstCard(catalog).syllabusIds = ['SQL-99.01']
    }],
    ['unsafe reference URL', (catalog: Record<string, unknown>) => {
      firstCard(catalog).references = [{ title: 'Unsafe', url: 'javascript:alert(1)' }]
    }],
  ])('rejects %s instead of partially loading cards', (_name, mutate) => {
    const catalog = draft()
    mutate(catalog)
    expect(() => validateCatalog(catalog)).toThrow('Invalid learning content')
  })
})

const fixtures: Record<string, string> = {
  'basic-select': `CREATE TABLE employees (employee_id INTEGER, employee_name TEXT, salary INTEGER);
    INSERT INTO employees VALUES (1, 'Asha', 50000), (2, 'Ben', 60000);`,
  'basic-distinct': `CREATE TABLE employees (employee_name TEXT, department TEXT);
    INSERT INTO employees VALUES ('Asha', 'Sales'), ('Ben', 'Sales'), ('Chen', 'Support');`,
  'filtering-where': `CREATE TABLE employees (employee_id INTEGER, employee_name TEXT, salary INTEGER);
    INSERT INTO employees VALUES (1, 'Asha', 50000), (2, 'Ben', 60000), (3, 'Chen', 70000);`,
  'filtering-null': `CREATE TABLE employees (employee_id INTEGER, employee_name TEXT, department TEXT);
    INSERT INTO employees VALUES (1, 'Asha', 'Sales'), (2, 'Ben', NULL), (3, 'Chen', 'Support');`,
}

const joinFixture = `CREATE TABLE customers (customer_id INTEGER, customer_name TEXT);
  CREATE TABLE orders (order_id INTEGER, customer_id INTEGER);
  INSERT INTO customers VALUES (1, 'Asha'), (2, 'Ben');
  INSERT INTO orders VALUES (101, 1), (102, 1);`

// SQLite is a test fixture only, not an app dependency or a teaching-dialect default.
// These checks verify the displayed examples on one engine, not universal portability.
describe('starter SQL examples', () => {
  it.each(loadCatalog().cards)('$id produces the displayed result on SQLite', (card) => {
    const db = new DatabaseSync(':memory:')
    try {
      const fixture = card.topicId === 'joins' ? joinFixture : fixtures[card.id]
      expect(fixture).toBeDefined()
      db.exec(fixture!)
      const sql = card.sections.examples.find((entry) => entry.kind === 'sql')
      const expected = card.sections.examples.filter((entry) => entry.kind === 'table').at(-1)
      expect(sql?.kind).toBe('sql')
      expect(expected?.kind).toBe('table')
      if (sql?.kind !== 'sql' || expected?.kind !== 'table') throw new Error('Missing example')
      const rows = db.prepare(sql.code).all()
      expect(rows.map((row) => expected.columns.map((column) =>
        row[column] === null ? 'NULL' : String(row[column]),
      ))).toEqual(expected.rows)
      for (const syntax of card.sections.syntax) {
        if (syntax.kind === 'sql') expect(() => db.prepare(syntax.code).all()).not.toThrow()
      }
    } finally {
      db.close()
    }
  })
})
