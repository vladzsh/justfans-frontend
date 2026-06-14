import { describe, it, expect } from 'vitest'
import {
  calcMonitorKpis,
  buildOverdueQueue,
  formatWaitDuration,
} from '@/stores/monitor'
import type { ChatterStatus, ModelStatus } from '@/types/contracts'

const NOW = new Date('2026-06-14T12:00:00Z').getTime()
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString()

function chatter(
  id: number,
  connected: boolean,
  lastSeenSecAgo: number,
  dialogs: number,
  waiting: { conversation_id: number; fan_name: string; waiting_since: string }[],
): ChatterStatus {
  return {
    id,
    display_name: `Chatter ${id}`,
    connected,
    last_seen: ago(lastSeenSecAgo),
    dialogs_count: dialogs,
    waiting,
  }
}

function model(
  id: number,
  name: string,
  avatar: string,
  waiting: { conversation_id: number; fan_name: string; waiting_since: string }[],
): ModelStatus {
  return { id, name, avatar, dialogs_count: waiting.length, waiting }
}

describe('calcMonitorKpis', () => {
  const chatters: ChatterStatus[] = [
    chatter(1, true, 5, 5, [
      { conversation_id: 10, fan_name: 'A', waiting_since: ago(100) },
      { conversation_id: 11, fan_name: 'B', waiting_since: ago(30) },
    ]),
    chatter(2, false, 9999, 3, [
      { conversation_id: 20, fan_name: 'C', waiting_since: ago(200) },
    ]),
  ]

  it('aggregates dialogs, waiting, overdue and online counts', () => {
    const kpis = calcMonitorKpis(chatters, NOW, 60, 30)
    expect(kpis.totalDialogs).toBe(8)
    expect(kpis.totalWaiting).toBe(3)
    // 100s and 200s exceed the 60s threshold; 30s does not
    expect(kpis.overdueCount).toBe(2)
    // chatter 1 connected + fresh last_seen → online; chatter 2 disconnected → offline
    expect(kpis.onlineCount).toBe(1)
    expect(kpis.totalChatters).toBe(2)
  })

  it('treats a connected chatter with stale last_seen as offline', () => {
    const stale = [chatter(1, true, 120, 2, [])]
    const kpis = calcMonitorKpis(stale, NOW, 60, 30)
    expect(kpis.onlineCount).toBe(0)
  })
})

describe('buildOverdueQueue', () => {
  const chatters: ChatterStatus[] = [
    chatter(1, true, 5, 5, [
      { conversation_id: 10, fan_name: 'A', waiting_since: ago(100) },
      { conversation_id: 11, fan_name: 'B', waiting_since: ago(30) },
    ]),
    chatter(2, true, 5, 3, [
      { conversation_id: 20, fan_name: 'C', waiting_since: ago(200) },
    ]),
  ]
  const models: ModelStatus[] = [
    model(1, 'Stella', '💃', [{ conversation_id: 10, fan_name: 'A', waiting_since: ago(100) }]),
    model(2, 'Mia', '🌸', [
      { conversation_id: 11, fan_name: 'B', waiting_since: ago(30) },
      { conversation_id: 20, fan_name: 'C', waiting_since: ago(200) },
    ]),
  ]

  it('flattens waiting dialogs, joins model info, sorts oldest-first, flags overdue', () => {
    const rows = buildOverdueQueue(chatters, models, NOW, 60)
    expect(rows.map((r) => r.conversation_id)).toEqual([20, 10, 11])
    expect(rows.map((r) => r.model_name)).toEqual(['Mia', 'Stella', 'Mia'])
    expect(rows.map((r) => r.chatter_name)).toEqual(['Chatter 2', 'Chatter 1', 'Chatter 1'])
    expect(rows.map((r) => r.overdue)).toEqual([true, true, false])
  })

  it('leaves model fields undefined when no model owns the conversation', () => {
    const orphan = [chatter(3, true, 5, 1, [
      { conversation_id: 99, fan_name: 'Z', waiting_since: ago(50) },
    ])]
    const rows = buildOverdueQueue(orphan, models, NOW, 60)
    expect(rows[0].model_name).toBeUndefined()
    expect(rows[0].model_avatar).toBeUndefined()
  })
})

describe('formatWaitDuration', () => {
  it('formats sub-minute durations as seconds', () => {
    expect(formatWaitDuration(ago(45), NOW)).toBe('45с')
  })

  it('formats minutes with zero-padded seconds', () => {
    expect(formatWaitDuration(ago(125), NOW)).toBe('2м 05с')
  })

  it('formats hours with zero-padded minutes', () => {
    expect(formatWaitDuration(ago(2 * 3600 + 5 * 60), NOW)).toBe('2ч 05м')
  })

  it('formats multi-day durations as days and hours (no minute:second overflow)', () => {
    expect(formatWaitDuration(ago(86400 + 3 * 3600), NOW)).toBe('1д 03ч')
  })

  it('returns a dash for an invalid timestamp', () => {
    expect(formatWaitDuration('not-a-date', NOW)).toBe('—')
  })

  it('clamps a future timestamp to zero seconds', () => {
    expect(formatWaitDuration(new Date(NOW + 5000).toISOString(), NOW)).toBe('0с')
  })
})
