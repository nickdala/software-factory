export type Stage =
  | 'queued'
  | 'intent'
  | 'human-review'
  | 'spec'
  | 'plan'
  | 'build'
  | 'review'
  | 'approval'
  | 'merging'
  | 'merged'
  | 'needs-human'

/** The fields of factory/jobs/<id>/job.json the mod reads. */
export type Job = { id: string; title?: string; stage: Stage; note?: string; gate?: Gate | null }

/** The human gate a `human-review` job waits at. */
export type Gate = 'intent' | 'spec' | 'plan'

/** Last stage the mod saw per job id; null before the first read. */
export type Seen = Record<string, Stage> | null

declare module 'claude-code' {
  interface PluginState {
    'software-factory': { seen: Seen }
  }
}
