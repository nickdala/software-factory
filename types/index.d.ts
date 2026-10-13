export type Stage =
  | 'queued'
  | 'spec'
  | 'build'
  | 'review'
  | 'approval'
  | 'merging'
  | 'merged'
  | 'needs-human'

/** The fields of factory/jobs/<id>/job.json the mod reads. */
export type Job = { id: string; title?: string; stage: Stage; note?: string }

/** Last stage the mod saw per job id; null before the first read. */
export type Seen = Record<string, Stage> | null

declare module 'claude-code' {
  interface PluginState {
    'software-factory': { seen: Seen }
  }
}
