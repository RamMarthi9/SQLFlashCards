import { useEffect, useRef, useState } from 'react'
import { sectionIds, type Flashcard, type SectionId, type Topic } from '../../content/catalog'
import { cardHref } from '../routes'
import { ContentBlocks, Icon, JoinDiagram } from '../components/LearningContent'
import { TopicCompletion } from '../components/TopicCompletion'
import type { TopicProgressController } from '../useTopicProgress'

const sectionLabels: Record<SectionId, string> = { definition: 'Definition', concept: 'Concept', examples: 'Examples', syntax: 'Syntax' }
const sectionHints: Record<SectionId, string> = { definition: 'What it means', concept: 'How it works', examples: 'See it in action', syntax: 'Write the query' }

export function LearningScreen({ topic, card, cards, progress }: { topic: Topic; card: Flashcard; cards: Flashcard[]; progress: TopicProgressController }) {
  const [revealed, setRevealed] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const tiles = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({})
  const position = cards.findIndex((item) => item.id === card.id)
  const previous = cards[position - 1]
  const next = cards[position + 1]
  useEffect(() => { heading.current?.focus() }, [])
  function closeSection() {
    if (activeSection) tiles.current[activeSection]?.focus()
    setActiveSection(null)
  }
  return <>
    <nav className="study-toolbar" aria-label="Topic navigation"><a className="back-link" href="#/topics">All topics</a><span className="card-position">{topic.title} · Card {position + 1} of {cards.length}</span></nav>
    <section className="topic-hero" aria-labelledby="card-title"><div className="hero-copy"><p className="eyebrow">LET'S LEARN SQL</p><h1 ref={heading} id="card-title" tabIndex={-1}>{card.title}</h1><p className="hero-subtitle">One concept. Four ways to understand it.</p></div>
      {card.diagram ? <JoinDiagram {...card.diagram} /> : <span className="hero-symbol" aria-hidden="true">SQL<span>_</span></span>}
    </section>
    <section className="study-prompt" aria-labelledby="question-title"><p className="eyebrow">THINK IT THROUGH</p><h2 id="question-title">{card.question}</h2>
      <button className="primary-button" aria-expanded={revealed} aria-controls="card-answer" onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide answer' : 'Reveal answer'}</button>
      <div id="card-answer" className="answer" hidden={!revealed} role="region" aria-label="Answer" aria-live="polite">{revealed && <><h3>Answer</h3><p>{card.answer}</p></>}</div>
    </section>
    <div className="section-grid" aria-label="Explore this concept">{sectionIds.map((id) => <button key={id} ref={(element) => { tiles.current[id] = element }} className={`section-tile ${id}`} aria-expanded={activeSection === id} aria-controls="learning-section" onClick={() => setActiveSection(activeSection === id ? null : id)}>
      <Icon kind={id} className="tile-icon" /><span><span className="tile-label">{sectionLabels[id]}</span><span className="tile-hint">{sectionHints[id]}</span></span>
    </button>)}</div>
    <section id="learning-section" className="section-panel" hidden={!activeSection} aria-label={activeSection ? sectionLabels[activeSection] : 'Learning section'}>{activeSection && <>
      <div className="panel-heading"><h2>{sectionLabels[activeSection]}</h2><button className="quiet-button" onClick={closeSection}>Close section</button></div><ContentBlocks blocks={card.sections[activeSection]} label={sectionLabels[activeSection]} />
    </>}</section>
    <nav className="card-navigation" aria-label="Card navigation">
      {previous ? <a className="nav-button" href={cardHref(previous)}>Previous card</a> : <span className="nav-button nav-button--disabled" aria-disabled="true">Previous card</span>}<span className="card-position">{position + 1} / {cards.length}</span>
      {next ? <a className="nav-button" href={cardHref(next)}>Next card</a> : <span className="nav-button nav-button--disabled" aria-disabled="true">Next card</span>}
    </nav>
    <section className="study-completion" aria-label="Topic progress"><div><h2>{topic.title}</h2><p>Ready to move on? Mark this topic completed, or return to it later.</p></div><TopicCompletion topic={topic} hasCards={cards.length > 0} progress={progress} /></section>
    {card.references && <details className="card-sources"><summary>Sources &amp; syllabus</summary><p>Curriculum: {card.syllabusIds.join(', ')}</p><ul>{card.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title} (opens in a new tab)</a></li>)}</ul></details>}
  </>
}
