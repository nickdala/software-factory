// The factory's mod: a status line and toasts, driven by <cwd>/factory/jobs/*/job.json.
// Read-only: each job's orchestrator session is the only writer of its job.json.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Gate, Job, Seen, Stage } from '../types'

const MAX_PARALLEL = 3
const POLL_MS = 2000
const ACTIVE: readonly Stage[] = ['intent', 'spec', 'plan', 'build', 'review', 'approval', 'merging']

const seen = atom({ plugin: 'software-factory', key: 'seen' } as const, null as Seen)

/** `factory ▸ 2/3 running · 1 in review · 1 awaiting review · 1 needs-human`, or undefined when idle. */
export const statusText = (jobs: readonly Job[]): string | undefined => {
  const count = (stages: readonly Stage[]) => jobs.filter(job => stages.includes(job.stage)).length
  const running = count(ACTIVE)
  const parts = [
    running > 0 ? `${running}/${MAX_PARALLEL} running` : '',
    count(['review']) > 0 ? `${count(['review'])} in review` : '',
    count(['human-review']) > 0 ? `${count(['human-review'])} awaiting review` : '',
    count(['queued']) > 0 ? `${count(['queued'])} queued` : '',
    count(['needs-human']) > 0 ? `${count(['needs-human'])} needs-human` : '',
  ].filter(Boolean)

  return parts.length === 0 ? undefined : `factory ▸ ${parts.join(' · ')}`
}

/** The toast for a job moving from one stage to another, if it deserves one. */
export const toastFor = (id: string, from: Stage, to: Stage, gate?: Gate | null): string | undefined => {
  if (to === 'human-review') return `◆ factory: ${id} ${gate ?? 'gate'} ready for human review`
  if (to === 'needs-human') return `⚠ factory: ${id} needs a human`
  if (to === 'merged') return `✓ factory: ${id} merged`
  if (from === 'merging' && to === 'build') return `✗ factory: ${id} failed to merge, back to the builder`

  return undefined
}

const parse = (text: string): Job | undefined => {
  try {
    const job = JSON.parse(text) as Job

    return typeof job.id === 'string' && typeof job.stage === 'string' ? job : undefined
  } catch {
    return undefined // mid-write or hand-edited; try again next tick
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const dir = `${e.cwd}/factory/jobs`

    const tick = async () => {
      const entries = await $.fs.list(dir).catch(() => undefined)
      if (entries === undefined) {
        $.ui.status(undefined)
        return
      }
      const texts = await Promise.all(
        entries
          .filter(entry => entry.kind === 'dir')
          .map(entry => $.fs.read(`${dir}/${entry.name}/job.json`).catch(() => undefined)),
      )
      const jobs = texts.flatMap(text => (typeof text === 'string' ? (parse(text) ?? []) : []))

      $.ui.status(statusText(jobs))

      const before = await read($, seen)
      const now: Record<string, Stage> = { ...before }
      for (const job of jobs) {
        const from = before?.[job.id]
        const toast = from !== undefined && from !== job.stage ? toastFor(job.id, from, job.stage, job.gate) : undefined
        if (toast !== undefined) $.ui.toast(toast, { timeoutMs: 8000 })
        now[job.id] = job.stage
      }
      await update($, seen, () => now)
    }

    await tick()
    $.clock.every(POLL_MS, () => void tick())

    return next(e)
  })
}
