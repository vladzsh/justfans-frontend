import { describe, it, expect } from 'vitest'
import type { ChatterStatus, ModelStatus } from '@/types/contracts'
import {
  buildChatterLoadChart,
  buildWaitingByChatterChart,
  buildOnlineDoughnut,
  buildModelLoadChart,
} from '@/utils/charts'

const BASE_TIME = 1_700_000_000_000

function makeChatter(
  id: number,
  opts: {
    connected?: boolean
    lastSeenMs?: number
    dialogs_count?: number
    waiting?: { conversation_id: number; fan_name: string; waiting_since: string }[]
  } = {},
): ChatterStatus {
  return {
    id,
    display_name: `Chatter ${id}`,
    connected: opts.connected ?? true,
    last_seen: opts.lastSeenMs != null ? new Date(opts.lastSeenMs).toISOString() : null,
    dialogs_count: opts.dialogs_count ?? 0,
    waiting: opts.waiting ?? [],
    dialogs: [],
  }
}

function makeModel(
  id: number,
  name: string,
  dialogs_count = 0,
  waiting: { conversation_id: number; fan_name: string; waiting_since: string }[] = [],
): ModelStatus {
  return { id, name, avatar: '💃', dialogs_count, waiting }
}

// ─── buildChatterLoadChart ────────────────────────────────────────────────────

describe('buildChatterLoadChart', () => {
  it('returns correct labels and data for chatters', () => {
    const chatters = [
      makeChatter(1, { dialogs_count: 5 }),
      makeChatter(2, { dialogs_count: 3 }),
    ]
    const result = buildChatterLoadChart(chatters)
    expect(result.labels).toEqual(['Chatter 1', 'Chatter 2'])
    expect(result.datasets).toHaveLength(1)
    expect(result.datasets[0].data).toEqual([5, 3])
  })

  it('returns empty labels and data for empty input', () => {
    const result = buildChatterLoadChart([])
    expect(result.labels).toEqual([])
    expect(result.datasets[0].data).toEqual([])
  })

  it('single chatter', () => {
    const result = buildChatterLoadChart([makeChatter(1, { dialogs_count: 7 })])
    expect(result.labels).toEqual(['Chatter 1'])
    expect(result.datasets[0].data).toEqual([7])
  })
})

// ─── buildWaitingByChatterChart ───────────────────────────────────────────────

describe('buildWaitingByChatterChart', () => {
  const OVERDUE_SECONDS = 120

  it('counts waiting and overdue correctly — overdue respects threshold', () => {
    const chatters = [
      makeChatter(1, {
        waiting: [
          // 130s ago → overdue
          { conversation_id: 1, fan_name: 'Fan A', waiting_since: new Date(BASE_TIME - 130_000).toISOString() },
          // 50s ago → NOT overdue
          { conversation_id: 2, fan_name: 'Fan B', waiting_since: new Date(BASE_TIME - 50_000).toISOString() },
        ],
      }),
    ]
    const result = buildWaitingByChatterChart(chatters, BASE_TIME, OVERDUE_SECONDS)
    expect(result.labels).toEqual(['Chatter 1'])
    // Waiting dataset: total waiting.length = 2
    expect(result.datasets[0].data).toEqual([2])
    expect(result.datasets[0].label).toBe('Ждут')
    // Overdue dataset: only Fan A (130s > 120s)
    expect(result.datasets[1].data).toEqual([1])
    expect(result.datasets[1].label).toBe('Просрочено')
  })

  it('zero overdue when no dialog exceeds threshold', () => {
    const chatters = [
      makeChatter(1, {
        waiting: [
          { conversation_id: 1, fan_name: 'Fan A', waiting_since: new Date(BASE_TIME - 60_000).toISOString() },
        ],
      }),
    ]
    const result = buildWaitingByChatterChart(chatters, BASE_TIME, OVERDUE_SECONDS)
    expect(result.datasets[0].data).toEqual([1]) // waiting
    expect(result.datasets[1].data).toEqual([0]) // overdue
  })

  it('all overdue when all dialogs exceed threshold', () => {
    const chatters = [
      makeChatter(1, {
        waiting: [
          { conversation_id: 1, fan_name: 'Fan A', waiting_since: new Date(BASE_TIME - 200_000).toISOString() },
          { conversation_id: 2, fan_name: 'Fan B', waiting_since: new Date(BASE_TIME - 300_000).toISOString() },
        ],
      }),
    ]
    const result = buildWaitingByChatterChart(chatters, BASE_TIME, OVERDUE_SECONDS)
    expect(result.datasets[0].data).toEqual([2]) // waiting
    expect(result.datasets[1].data).toEqual([2]) // overdue
  })

  it('returns two datasets with empty data for empty input', () => {
    const result = buildWaitingByChatterChart([], BASE_TIME, OVERDUE_SECONDS)
    expect(result.labels).toEqual([])
    expect(result.datasets).toHaveLength(2)
    expect(result.datasets[0].data).toEqual([])
    expect(result.datasets[1].data).toEqual([])
  })

  it('overdue counting uses the correct time reference (nowMs)', () => {
    const waitingSince = new Date(BASE_TIME - 100_000).toISOString() // 100s ago
    const chatters = [makeChatter(1, { waiting: [{ conversation_id: 1, fan_name: 'F', waiting_since: waitingSince }] })]

    // At BASE_TIME: 100s < 120s → not overdue
    const r1 = buildWaitingByChatterChart(chatters, BASE_TIME, OVERDUE_SECONDS)
    expect(r1.datasets[1].data).toEqual([0])

    // 30s later: 130s > 120s → overdue
    const r2 = buildWaitingByChatterChart(chatters, BASE_TIME + 30_000, OVERDUE_SECONDS)
    expect(r2.datasets[1].data).toEqual([1])
  })
})

// ─── buildOnlineDoughnut ──────────────────────────────────────────────────────

describe('buildOnlineDoughnut', () => {
  const GRACE_SECONDS = 30

  it('online/offline split is correct', () => {
    const chatters = [
      // online: connected=true, last_seen fresh (5s ago)
      makeChatter(1, { connected: true, lastSeenMs: BASE_TIME - 5_000 }),
      // offline: connected=false (clean disconnect)
      makeChatter(2, { connected: false, lastSeenMs: BASE_TIME - 2_000 }),
      // offline: connected=true but last_seen stale (35s ago > 30s grace)
      makeChatter(3, { connected: true, lastSeenMs: BASE_TIME - 35_000 }),
    ]
    const result = buildOnlineDoughnut(chatters, BASE_TIME, GRACE_SECONDS)
    expect(result.labels).toEqual(['Онлайн', 'Офлайн'])
    expect(result.datasets[0].data).toEqual([1, 2]) // 1 online, 2 offline
  })

  it('all online', () => {
    const chatters = [
      makeChatter(1, { connected: true, lastSeenMs: BASE_TIME - 5_000 }),
      makeChatter(2, { connected: true, lastSeenMs: BASE_TIME - 10_000 }),
    ]
    const result = buildOnlineDoughnut(chatters, BASE_TIME, GRACE_SECONDS)
    expect(result.datasets[0].data).toEqual([2, 0])
  })

  it('all offline', () => {
    const chatters = [
      makeChatter(1, { connected: false, lastSeenMs: BASE_TIME - 1_000 }),
      makeChatter(2, { connected: false, lastSeenMs: BASE_TIME - 1_000 }),
    ]
    const result = buildOnlineDoughnut(chatters, BASE_TIME, GRACE_SECONDS)
    expect(result.datasets[0].data).toEqual([0, 2])
  })

  it('empty input returns [0, 0]', () => {
    const result = buildOnlineDoughnut([], BASE_TIME, GRACE_SECONDS)
    expect(result.datasets[0].data).toEqual([0, 0])
  })
})

// ─── buildModelLoadChart ──────────────────────────────────────────────────────

describe('buildModelLoadChart', () => {
  it('returns correct labels with avatar and name', () => {
    const models = [
      makeModel(1, 'Stella', 8),
      makeModel(2, 'Luna', 3),
    ]
    const result = buildModelLoadChart(models)
    expect(result.labels).toEqual(['💃 Stella', '💃 Luna'])
    expect(result.datasets[0].data).toEqual([8, 3])
  })

  it('returns empty data for empty input', () => {
    const result = buildModelLoadChart([])
    expect(result.labels).toEqual([])
    expect(result.datasets[0].data).toEqual([])
  })

  it('single model', () => {
    const result = buildModelLoadChart([makeModel(1, 'Nova', 12)])
    expect(result.labels).toEqual(['💃 Nova'])
    expect(result.datasets[0].data).toEqual([12])
  })
})
