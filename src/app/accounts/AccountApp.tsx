import { useCallback, useEffect, useRef, useState } from 'react'
import type { Catalog } from '../../content/catalog'
import type { ProgressRepository } from '../../domain/progress'
import { createProgressRepository } from '../../storage/indexedDbProgress'
import { AccountApiError, accountRequest, authenticateAccount, createHttpProgressRepository, getSession, type Account } from '../../storage/httpProgress'
import { LearningApp } from '../LearningApp'
import { Icon } from '../components/LearningContent'

type SessionState =
  | { kind: 'loading' | 'signing-out' }
  | { kind: 'guest'; message?: string }
  | { kind: 'account'; account: Account }
  | { kind: 'error'; message: string; retry: 'load' | 'logout' }

function message(error: unknown) { return error instanceof Error ? error.message : 'Please try again.' }

export function AccountApp({ loadContent }: { loadContent: () => Catalog }) {
  const [session, setSession] = useState<SessionState>({ kind: 'loading' })
  const current = useRef(session)
  const generation = useRef(0)
  const authenticating = useRef(false)
  const signOutAccount = useRef<string | null>(null)
  const mounted = useRef(false)
  const invalidate = useCallback(() => { generation.current++ }, [])
  const update = useCallback((next: SessionState) => { current.current = next; setSession(next) }, [])

  const reload = useCallback(() => {
    if (authenticating.current || current.current.kind === 'signing-out') return
    const request = ++generation.current
    void getSession().then((account) => {
      if (!mounted.current || request !== generation.current) return
      update(account ? { kind: 'account', account } : { kind: 'guest' })
    }, (error: unknown) => {
      if (mounted.current && request === generation.current) update({ kind: 'error', message: message(error), retry: 'load' })
    })
  }, [update])

  useEffect(() => {
    mounted.current = true
    void reload()
    const onFocus = () => { void reload() }
    const onVisible = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted.current = false
      invalidate()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [invalidate, reload])

  const authenticate = async (action: 'signup' | 'login', name: string, pin: string) => {
    if (authenticating.current) return
    authenticating.current = true
    const request = ++generation.current
    try {
      const account = await authenticateAccount(action, name, pin)
      if (mounted.current && request === generation.current) update({ kind: 'account', account })
    } finally { authenticating.current = false }
  }

  const logout = async () => {
    if (current.current.kind === 'account') signOutAccount.current = current.current.account.id
    const request = ++generation.current
    update({ kind: 'signing-out' })
    try {
      await accountRequest('/api/logout', 'POST', {}, signOutAccount.current ?? undefined)
      if (mounted.current && request === generation.current) update({ kind: 'guest' })
    } catch (error) {
      if (mounted.current && request === generation.current) {
        if (error instanceof AccountApiError && (error.status === 401 || error.code === 'account_changed')) update({ kind: 'guest', message: 'Your session ended or the signed-in account changed. Sign in again to continue.' })
        else update({ kind: 'error', message: message(error), retry: 'logout' })
      }
    }
  }

  const onSessionInvalid = useCallback((accountId: string) => {
    if (mounted.current && current.current.kind === 'account' && current.current.account.id === accountId) {
      invalidate()
      update({ kind: 'guest', message: 'Your session ended or the signed-in account changed. Sign in again to continue.' })
    }
  }, [invalidate, update])

  if (session.kind === 'account') return <AccountWorkspace key={session.account.id} account={session.account} loadContent={loadContent} onLogout={() => { void logout() }} onSessionInvalid={onSessionInvalid} />
  return <div className="app-shell account-shell">
    <header className="site-header"><a className="brand" href="#/topics" aria-label="SQLFlashCards home"><Icon kind="cards" className="brand-icon" /><span>SQLFlashCards</span></a></header>
    <main>
      {session.kind === 'guest' ? <AccountForm onAuthenticate={authenticate} notice={session.message} />
        : session.kind === 'error' ? <section className="account-card"><h1>We couldn’t connect to your account</h1><p role="alert">{session.message}</p><button className="primary-button" onClick={() => { if (session.retry === 'logout') void logout(); else void reload() }}>{session.retry === 'logout' ? 'Retry sign out' : 'Retry connection'}</button></section>
          : <section className="account-card"><p role="status">{session.kind === 'signing-out' ? 'Signing out…' : 'Checking your account…'}</p></section>}
    </main>
  </div>
}

function AccountForm({ onAuthenticate, notice }: { onAuthenticate: (action: 'signup' | 'login', name: string, pin: string) => Promise<void>; notice: string | undefined }) {
  const [action, setAction] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!/^[0-9]{4}$/.test(pin)) { setError('Enter exactly four digits for your PIN.'); return }
    if (name.trim().length < 2 || name.trim().length > 40) { setError('Use a name with 2 to 40 characters.'); return }
    setBusy(true)
    setError('')
    try { await onAuthenticate(action, name, pin) }
    catch (failure) { if (active.current) setError(message(failure)) }
    finally { if (active.current) { setBusy(false); setPin('') } }
  }
  return <section className="account-card">
    <p className="eyebrow">YOUR SQL JOURNEY</p>
    <h1 ref={heading} tabIndex={-1}>{action === 'signup' ? 'Keep your learning with you.' : 'Welcome back.'}</h1>
    <p>{action === 'signup' ? 'Choose a name and a four-digit PIN. Your completed topics will be saved to your account.' : 'Use your name and PIN to pick up where you left off.'}</p>
    {notice && <p role="status">{notice}</p>}
    <div className="account-tabs" role="group" aria-label="Account action">
      <button className="filter-button" aria-pressed={action === 'signup'} disabled={busy} onClick={() => { setAction('signup'); setError(''); setPin('') }}>Sign up</button>
      <button className="filter-button" aria-pressed={action === 'login'} disabled={busy} onClick={() => { setAction('login'); setError(''); setPin('') }}>Sign in</button>
    </div>
    <form className="account-form" onSubmit={(event) => { void submit(event) }}>
      <label htmlFor="account-name">Name</label>
      <input id="account-name" name="username" autoComplete="username" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} required disabled={busy} aria-describedby="name-help" />
      <p id="name-help" className="field-help">Use a unique name. Letter case does not matter when signing in.</p>
      <label htmlFor="account-pin">4-digit PIN</label>
      <input id="account-pin" name="password" type="password" inputMode="numeric" autoComplete={action === 'signup' ? 'new-password' : 'current-password'} pattern="[0-9]{4}" minLength={4} maxLength={4} value={pin} onChange={(event) => setPin(event.target.value)} required disabled={busy} aria-describedby="pin-help" />
      <p id="pin-help" className="field-help">Remember your name and PIN. Without an email address, forgotten PINs cannot be recovered.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : action === 'signup' ? 'Create account' : 'Continue learning'}</button>
    </form>
  </section>
}

function AccountWorkspace({ account, loadContent, onLogout, onSessionInvalid }: {
  account: Account; loadContent: () => Catalog; onLogout: () => void; onSessionInvalid: (accountId: string) => void
}) {
  const [repository] = useState(() => createHttpProgressRepository(account.id, () => onSessionInvalid(account.id)))
  const [refresh, setRefresh] = useState(0)
  return <LearningApp loadContent={loadContent} progressRepository={repository} refreshProgressToken={refresh}
    accountControls={<div className="account-controls"><span>Signed in as <strong>{account.name}</strong></span><button className="quiet-button" onClick={onLogout}>Sign out</button></div>}
    importControls={<LegacyImport repository={repository} loadContent={loadContent} onImported={() => setRefresh((value) => value + 1)} />} />
}

function LegacyImport({ repository, loadContent, onImported }: { repository: ProgressRepository; loadContent: () => Catalog; onImported: () => void }) {
  const [owned, setOwned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const active = useRef(false)
  const running = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  async function importProgress() {
    if (!owned || running.current) return
    running.current = true
    setBusy(true); setError(''); setResult('')
    const local = createProgressRepository()
    let imported = 0
    try {
      const catalog = loadContent()
      const oldRecords = await local.getAll()
      const saved = await repository.getAll()
      const existing = new Set(saved.map((record) => record.topicId))
      for (const record of oldRecords) {
        if (!active.current) return
        if (existing.has(record.topicId) || !catalog.topics.some((topic) => topic.id === record.topicId)
          || (record.covered && !catalog.cards.some((card) => card.topicId === record.topicId))) continue
        const outcome = await repository.setTopicCovered({ topicId: record.topicId, covered: record.covered, expectedVersion: 0, changedAt: new Date().toISOString() })
        if (outcome.kind === 'saved') imported++
      }
      if (active.current) {
        setResult(`Imported ${imported} ${imported === 1 ? 'topic' : 'topics'}. Existing account progress and the browser copy were kept.`)
      }
    } catch (failure) {
      if (active.current) setError(`Import was not completed. ${message(failure)} Topics already copied are safe; you can retry.`)
    } finally {
      local.close()
      running.current = false
      if (active.current) {
        setBusy(false)
        if (imported > 0) onImported()
      }
    }
  }
  return <details className="legacy-import"><summary>Bring over progress from the earlier app</summary>
    <p>Copy this browser’s old progress into your account. Only do this if those saved topics are yours. Existing account progress will not be overwritten.</p>
    <label className="import-confirm"><input type="checkbox" checked={owned} disabled={busy} onChange={(event) => setOwned(event.target.checked)} />These browser-saved topics are mine</label>
    <button className="quiet-button" disabled={!owned || busy} onClick={() => { void importProgress() }}>{busy ? 'Importing…' : 'Import browser progress'}</button>
    {result && <p role="status">{result}</p>}{error && <p role="alert">{error}</p>}
  </details>
}
