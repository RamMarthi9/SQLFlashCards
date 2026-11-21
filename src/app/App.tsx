import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { loadCatalog, type Catalog } from '../content/catalog'
import { resolveRoute } from './routes'
import { TopicListScreen } from './screens/TopicListScreen'
import { LearningScreen } from './screens/LearningScreen'
import { Icon } from './components/LearningContent'
import './App.css'

function subscribeToRoute(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
function readHash() { return window.location.hash }
type ContentState = { kind: 'ready'; catalog: Catalog } | { kind: 'error' }
function readContent(loader: () => Catalog): ContentState {
  try { return { kind: 'ready', catalog: loader() } }
  catch { return { kind: 'error' } }
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="empty-state"><h1 ref={heading} tabIndex={-1}>{title}</h1>{children}</section>
}

export default function App({ loadContent = loadCatalog }: { loadContent?: () => Catalog }) {
  const [content, setContent] = useState(() => readContent(loadContent))
  const hash = useSyncExternalStore(subscribeToRoute, readHash)
  const route = content.kind === 'ready' ? resolveRoute(hash, content.catalog) : null
  const title = route?.kind === 'card' ? route.card.title : 'Learn SQL'
  useEffect(() => { document.title = `${title} | SQLFlashCards` }, [title])

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault()
      document.getElementById('main-content')?.focus()
    }}>Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#/topics" aria-label="SQLFlashCards home"><Icon kind="cards" className="brand-icon" /><span>SQLFlashCards</span></a>
      <span className="header-note">A little SQL, every day.</span>
    </header>
    <main id="main-content" tabIndex={-1}>
      {content.kind === 'error' ? <Notice title="We couldn't load the cards">
        <p>Please try loading the learning collection again.</p>
        <button className="primary-button" onClick={() => setContent(readContent(loadContent))}>Try again</button>
      </Notice> : route?.kind === 'topics' ? <TopicListScreen key="topics" catalog={content.catalog} />
        : route?.kind === 'card' ? <LearningScreen key={hash} topic={route.topic} card={route.card} cards={route.cards} />
          : <Notice key={hash} title="This card isn't available"><p>The link may be out of date. Choose a topic to continue learning.</p><a className="primary-button" href="#/topics">Back to topics</a></Notice>}
    </main>
    <footer className="site-footer"><span>Learn. Revisit. Understand.</span><span>Practice freely · Progress saving is coming soon</span></footer>
  </div>
}
