import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Job } from '../types'
import { statusText } from './register'

const CWD = '/repo'
const JOBS = `${CWD}/factory/jobs`

const job = (id: string, stage: Job['stage']): Job => ({ id, stage })

// Calls on $ answer `{ value }` or `{ deny }`.
// Wires the world beneath the mod: a clock, a factory/jobs folder (or none) with
// one job.json per job, and recorders for the status line and toasts.
const world = ($: Engine, on: On, initial: Job[] | undefined) => {
  const clock = mock.clock(on)
  const state = { jobs: initial, statuses: [] as (string | undefined)[], toasts: [] as string[] }

  on('fs.list', ($, e) => {
    if (e.path !== JOBS || state.jobs === undefined) return { deny: `ENOENT: ${e.path}` }
    return {
      value: state.jobs.map(one => ({ name: one.id, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })),
    }
  })
  on('fs.read', ($, e) => {
    const found = state.jobs?.find(one => e.path === `${JOBS}/${one.id}/job.json`)
    return found === undefined ? { deny: `ENOENT: ${e.path}` } : { value: JSON.stringify(found) }
  })
  on('ui.status', ($, e) => {
    state.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    state.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  const start = () => $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })

  return { clock, state, start }
}

test('status text summarizes running, review, queued and needs-human jobs', () => {
  const jobs = [
    job('001-a', 'review'),
    job('002-b', 'build'),
    job('003-c', 'queued'),
    job('004-d', 'needs-human'),
    job('005-e', 'merged'),
  ]
  expect(statusText(jobs)).toBe('factory ▸ 2/3 running · 1 in review · 1 queued · 1 needs-human')
  expect(statusText([job('005-e', 'merged')])).toBe(undefined)
})

test('shows the status line from every job.json on session start', async ($, on) => {
  const w = world($, on, [job('001-a', 'review'), job('002-b', 'spec')])
  await w.start()

  expect(w.state.statuses.at(-1)).toBe('factory ▸ 2/3 running · 1 in review')
  expect(w.state.toasts).toEqual([])
})

test('toasts once per transition and never repeats', async ($, on) => {
  const w = world($, on, [job('001-a', 'approval'), job('002-b', 'merging')])
  await w.start()

  w.state.jobs = [job('001-a', 'needs-human'), job('002-b', 'build')]
  await w.clock.advance(2000)
  await w.clock.advance(2000)
  await w.clock.advance(2000)

  expect(w.state.toasts).toEqual([
    '⚠ factory: 001-a needs a human',
    '✗ factory: 002-b failed to merge, back to the builder',
  ])

  w.state.jobs = [job('001-a', 'merging'), job('002-b', 'build')]
  await w.clock.advance(2000)
  w.state.jobs = [job('001-a', 'merged'), job('002-b', 'build')]
  await w.clock.advance(2000)

  expect(w.state.toasts.at(-1)).toBe('✓ factory: 001-a merged')
  expect(w.state.toasts).toHaveLength(3)
})

test('a job created by another session is recorded without a toast', async ($, on) => {
  const w = world($, on, [job('001-a', 'build')])
  await w.start()

  w.state.jobs = [job('001-a', 'build'), job('002-b', 'spec')]
  await w.clock.advance(2000)
  w.state.jobs = [job('001-a', 'build'), job('002-b', 'needs-human')]
  await w.clock.advance(2000)

  expect(w.state.toasts).toEqual(['⚠ factory: 002-b needs a human'])
})

test('stays silent when factory/jobs is absent', async ($, on) => {
  const w = world($, on, undefined)
  await w.start()
  await w.clock.advance(6000)

  expect(w.state.toasts).toEqual([])
  expect(w.state.statuses.every(text => text === undefined)).toBe(true)
})
