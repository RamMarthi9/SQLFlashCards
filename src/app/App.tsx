import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <a className="wordmark" href="/" aria-label="SQLFlashCards home">
          <span className="brand-mark" aria-hidden="true">S<span>_</span></span>
          SQLFlashCards
        </a>
        <span className="learning-label">Learn SQL</span>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="welcome" aria-labelledby="welcome-title">
          <p className="eyebrow"><span aria-hidden="true" /> A little practice, lasting understanding</p>
          <h1 id="welcome-title">Your SQL practice <br />starts here.</h1>
          <p className="welcome-description">
            One concept at a time. A growing space to learn SQL,
            revisit what matters, and build confidence with every query.
          </p>
          <p className="development-note">
            <strong>We&apos;re laying the foundation.</strong> Learning features are
            coming in future stages.
          </p>
        </section>

        <section className="roadmap" aria-labelledby="roadmap-title">
          <div className="section-heading">
            <h2 id="roadmap-title">A thoughtful way to learn</h2>
            <span className="planned-label">Planned</span>
          </div>
          <ul className="feature-list">
            <li>
              <span className="feature-number" aria-hidden="true">01</span>
              <h3>Learn in small steps</h3>
              <p>Explore focused flashcards with clear explanations and SQL examples.</p>
            </li>
            <li>
              <span className="feature-number" aria-hidden="true">02</span>
              <h3>See your progress</h3>
              <p>Keep track of covered topics and find the next concept to work on.</p>
            </li>
            <li>
              <span className="feature-number" aria-hidden="true">03</span>
              <h3>Make it stick</h3>
              <p>Return for spaced revision and understand where your confidence is growing.</p>
            </li>
          </ul>
        </section>
      </main>

      <footer className="site-footer">
        <span>SQLFlashCards</span>
        <span>Learn. Revisit. Understand.</span>
      </footer>
    </div>
  )
}
