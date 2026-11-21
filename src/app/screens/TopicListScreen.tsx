import { useEffect, useRef } from 'react'
import type { Catalog } from '../../content/catalog'
import { cardHref } from '../routes'

export function TopicListScreen({ catalog }: { catalog: Catalog }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const available = catalog.topics.filter((topic) => catalog.cards.some((card) => card.topicId === topic.id)).length
  useEffect(() => { heading.current?.focus() }, [])
  return <>
    <section className="topic-intro">
      <p className="eyebrow">YOUR SQL LEARNING PATH</p>
      <h1 ref={heading} tabIndex={-1}>Small cards. Big understanding.</h1>
      <p>Choose a topic, try a question, and explore the idea behind the answer.</p>
      <p className="catalog-summary">{catalog.cards.length} flashcards ready · {available} of {catalog.topics.length} topics with cards</p>
    </section>
    {catalog.topics.length === 0 ? <section className="empty-state"><h2>No topics yet</h2><p>Learning content will appear here when it is available.</p></section>
      : <div className="topic-grid">{catalog.topics.map((topic) => {
        const cards = catalog.cards.filter((card) => card.topicId === topic.id)
        const first = cards[0]
        return <article className={`topic-card${first ? '' : ' topic-card--soon'}`} key={topic.id}>
          <span className="topic-number">SQL {String(topic.order).padStart(2, '0')}</span><h2>{topic.title}</h2>
          <p className="topic-detail">{first ? `${cards.length} focused flashcards` : 'Content coming soon'}</p>
          {first && <a className="topic-action" href={cardHref(first)} aria-label={`Start learning ${topic.title}`}>Start learning</a>}
        </article>
      })}</div>}
  </>
}
