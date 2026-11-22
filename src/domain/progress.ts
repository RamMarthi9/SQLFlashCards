export interface TopicProgress {
  topicId: string
  covered: boolean
  coveredAt: string | null
  updatedAt: string
  version: number
}

export interface CoverageChange {
  topicId: string
  covered: boolean
  changedAt: string
  expectedVersion: number
}

export type CoverageResult =
  | { kind: 'saved'; progress: TopicProgress }
  | { kind: 'stale'; current: TopicProgress | null }

export interface ProgressRepository {
  getAll(): Promise<TopicProgress[]>
  setTopicCovered(input: CoverageChange): Promise<CoverageResult>
  close(): void
}
