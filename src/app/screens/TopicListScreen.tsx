import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Catalog } from '../../content/catalog'
import { cardHref } from '../routes'
import { TopicCompletion } from '../components/TopicCompletion'
import type { TopicProgressController } from '../useTopicProgress'

export function TopicListScreen({ catalog, progress }: { catalog: Catalog; progress: TopicProgressController }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [filter, setFilter] = useState<'All' | 'Incomplete' | 'Completed'>('All')
  const selectedFilter = useRef<HTMLButtonElement>(null)
  const completionFocus = useRef<HTMLElement | null>(null)
  const ready = progress.phase === 'ready'
  const topics = catalog.topics.filter((topic) => !ready || filter === 'All' || progress.isCompleted(topic.id) === (filter === 'Completed'))
  const available = catalog.topics.filter((topic) => catalog.cards.some((card) => card.topicId === topic.id)).length
  useEffect(() => { heading.current?.focus() }, [])
  useLayoutEffect(() => {
    const action = completionFocus.current
    if (!action) return
    if (!action.isConnected && document.activeElement === document.body) selectedFilter.current?.focus()
    if (!action.isConnected || progress.savingId === null) completionFocus.current = null
  })
  return <>
    <section className="topic-intro">
      <p className="eyebrow">YOUR SQL LEARNING PATH</p>
      <h1 ref={heading} tabIndex={-1}>Small cards. Big understanding.</h1>
      <p>Choose a topic, try a question, and explore the idea behind the answer.</p>
      <p className="catalog-summary">{catalog.cards.length} flashcards ready · {available} of {catalog.topics.length} topics with cards</p>
    </section>
    <section className="progress-summary" aria-labelledby="progress-title">
      <div><p className="eyebrow">YOUR PROGRESS</p><h2 id="progress-title">{ready ? `${progress.completed} of ${progress.total} topics completed` : 'Your saved learning progress'}</h2>
        <p>You choose when a topic is complete. You can mark it incomplete any time.</p></div>
      {ready && <div className="progress-meter"><strong>{progress.percent}% completed</strong><progress aria-label="Completed topics" value={progress.completed} max={progress.total || 1} /></div>}
      <p className="storage-note">Saved to your account on this website. Sign in with the same name and PIN to continue on another browser or device.</p>
    </section>
    <div className="topic-filters" role="group" aria-label="Filter topics">{(['All', 'Incomplete', 'Completed'] as const).map((label) => <button key={label}
      ref={filter === label ? selectedFilter : undefined} className="filter-button" aria-pressed={filter === label} disabled={!ready}
      onClick={() => setFilter(label)}>{label} ({label === 'All' ? progress.total : ready ? label === 'Completed' ? progress.completed : progress.total - progress.completed : '…'})</button>)}</div>
    {catalog.topics.length === 0 ? <section className="empty-state"><h2>No topics yet</h2><p>Learning content will appear here when it is available.</p></section>
      : topics.length === 0 ? <section className="empty-state"><h2>{filter === 'Completed' ? 'No completed topics yet' : 'No incomplete topics'}</h2><p>{filter === 'Completed' ? 'Mark a topic completed when you are ready.' : 'You have completed all available syllabus topics.'}</p></section>
      : <div className="topic-grid">{topics.map((topic) => {
        const cards = catalog.cards.filter((card) => card.topicId === topic.id)
        const first = cards[0]
        return <article className={`topic-card${first ? '' : ' topic-card--soon'}`} key={topic.id}>
          <span className="topic-number">SQL {String(topic.order).padStart(2, '0')}</span><h2>{topic.title}</h2>
          <p className="topic-detail">{first ? `${cards.length} focused flashcards` : 'Content coming soon'}</p>
          {first && <a className="topic-action" href={cardHref(first)} aria-label={`Start learning ${topic.title}`}>Start learning</a>}
          <TopicCompletion topic={topic} hasCards={Boolean(first)} progress={{ ...progress, save: async (topicId, covered) => {
            if (filter !== 'All' && document.activeElement instanceof HTMLElement && document.activeElement.closest('.topic-card')) completionFocus.current = document.activeElement
            await progress.save(topicId, covered)
          } }} />
        </article>
      })}</div>}
  </>
}
