import type { Topic } from '../../content/catalog'
import type { TopicProgressController } from '../useTopicProgress'

export function TopicCompletion({ topic, hasCards, progress }: { topic: Topic; hasCards: boolean; progress: TopicProgressController }) {
  const completed = progress.isCompleted(topic.id)
  const ready = progress.phase === 'ready'
  return <div className="topic-completion">
    <span className={`completion-badge${ready && completed ? ' completion-badge--done' : ''}`}>{ready ? completed ? 'Completed' : 'Incomplete' : 'Progress unavailable'}</span>
    {(hasCards || completed) && <button className="quiet-button completion-button" disabled={!ready || progress.savingId !== null}
      aria-label={`Mark ${topic.title} ${completed ? 'incomplete' : 'completed'}`}
      onClick={() => { void progress.save(topic.id, !completed) }}>
      {progress.savingId === topic.id ? 'Saving…' : completed ? 'Mark incomplete' : 'Mark completed'}
    </button>}
  </div>
}

export function ProgressNotice({ progress }: { progress: TopicProgressController }) {
  return <div className="progress-notices">
    <p role="status" className="progress-announcement">{progress.phase === 'loading' ? 'Loading progress…' : progress.announcement}</p>
    {progress.issue && <div className="progress-error" role="alert">
      <p>{progress.issue.message}</p>
      <button className="quiet-button" disabled={progress.phase === 'loading' || progress.savingId !== null} onClick={progress.retry}>
        {progress.issue.change ? 'Retry save' : 'Retry loading progress'}
      </button>
    </div>}
  </div>
}
