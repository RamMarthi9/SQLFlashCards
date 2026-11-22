import { useCallback, useEffect, useRef, useState } from 'react'
import type { Catalog } from '../content/catalog'
import type { ProgressRepository, TopicProgress } from '../domain/progress'

type PendingChange = { topicId: string; covered: boolean }
type Issue = { message: string; change?: PendingChange }
type ProgressState = {
  phase: 'loading' | 'ready' | 'error'
  records: TopicProgress[]
  savingId: string | null
  issue: Issue | null
  announcement: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Browser storage is unavailable. Please try again.'
}

export function useTopicProgress(catalog: Catalog | null, repository: ProgressRepository) {
  const [state, setState] = useState<ProgressState>({ phase: 'loading', records: [], savingId: null, issue: null, announcement: '' })
  const current = useRef(state)
  const mounted = useRef(false)
  const generation = useRef(0)
  const refreshAfterSave = useRef(false)
  const invalidatePending = useCallback(() => { generation.current++ }, [])
  const update = useCallback((next: ProgressState) => {
    current.current = next
    setState(next)
  }, [])

  const reload = useCallback(async () => {
    if (current.current.savingId) { refreshAfterSave.current = true; return }
    const request = ++generation.current
    update({ ...current.current, phase: 'loading', announcement: '' })
    try {
      const records = await repository.getAll()
      if (mounted.current && generation.current === request) {
        update({ ...current.current, phase: 'ready', records, issue: current.current.issue?.change ? current.current.issue : null })
      }
    } catch (error) {
      if (mounted.current && generation.current === request) {
        update({ ...current.current, phase: 'error', issue: { message: `Couldn't load saved progress. ${errorMessage(error)}` } })
      }
    }
  }, [repository, update])

  useEffect(() => {
    mounted.current = true
    void reload()
    const onFocus = () => { void reload() }
    const onVisible = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted.current = false
      invalidatePending()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      repository.close()
    }
  }, [repository, reload, invalidatePending])

  const save = useCallback(async (topicId: string, covered: boolean) => {
    const before = current.current
    if (before.phase !== 'ready' || before.savingId || !catalog) return
    const topic = catalog.topics.find((item) => item.id === topicId)
    if (!topic || (covered && !catalog.cards.some((card) => card.topicId === topicId))) return
    const request = ++generation.current
    const previous = before.records.find((record) => record.topicId === topicId)
    update({ ...before, savingId: topicId, issue: null, announcement: '' })
    try {
      const result = await repository.setTopicCovered({ topicId, covered, expectedVersion: previous?.version ?? 0, changedAt: new Date().toISOString() })
      if (!mounted.current || request !== generation.current) return
      const progress = result.kind === 'saved' ? result.progress : result.current
      const records = current.current.records.filter((record) => record.topicId !== topicId)
      if (progress) records.push(progress)
      update({
        ...current.current, records, savingId: null,
        issue: result.kind === 'stale' ? { message: 'Your progress changed in another tab. The latest saved status is shown. Retry to apply your change.', change: { topicId, covered } } : null,
        announcement: result.kind === 'saved' ? `${topic.title} marked ${covered ? 'completed' : 'incomplete'}. Saved in this browser.` : '',
      })
    } catch (error) {
      if (!mounted.current || request !== generation.current) return
      update({ ...current.current, savingId: null, issue: { message: `Couldn't save progress. ${errorMessage(error)}`, change: { topicId, covered } } })
    }
    if (mounted.current && refreshAfterSave.current) {
      refreshAfterSave.current = false
      void reload()
    }
  }, [catalog, repository, reload, update])

  const completed = catalog?.topics.filter((topic) => state.records.some((record) => record.topicId === topic.id && record.covered)).length ?? 0
  const total = catalog?.topics.length ?? 0
  return {
    ...state, completed, total, percent: total === 0 ? 0 : Math.round(completed * 100 / total),
    isCompleted: (topicId: string) => state.records.some((record) => record.topicId === topicId && record.covered),
    save,
    retry: () => {
      const change = current.current.issue?.change
      if (change) void save(change.topicId, change.covered)
      else void reload()
    },
  }
}

export type TopicProgressController = ReturnType<typeof useTopicProgress>
