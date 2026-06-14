import { describe, it, expect } from 'vitest'
import {
  calcMonitorKpis,
  buildOverdueQueue,
  formatWaitDuration,
} from '@/stores/monitor'
import type { ChatterStatus, ModelStatus, MonitorDialog } from '@/types/contracts'

const NOW = new Date('2026-06-14T12:00:00Z').getTime()
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString()

function makeDialog(
  conversation_id: number,
  fan_name: string,
  awaiting_reply_since: string | null,
  model_id = 1,
  model_name = 'Stella',
  model_avatar = '💃',
): MonitorDialog {
  return { conversation_id, fan_name, awaiting_reply_since, model_id, model_name, model_avatar }
}

function chatter(
  id: number,
  connected: boolean,
  lastSeenSecAgo: number,
  dialogs_count: number,
  waiting: { conversation_id: number; fan_name: string; waiting_since: string }[],
  dialogs: MonitorDialog[] = [],
): ChatterStatus {
  return {
    id,
    display_name: `Chatter ${id}`,
    connected,
    last_seen: ago(lastSeenSecAgo),
    dialogs_count,
    waiting,
    dialogs,
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
  // Dialogs: conv 20 overdue (200s), conv 10 overdue (100s), conv 11 unanswered (30s), conv 30 ok (null)
  const chatters: ChatterStatus[] = [
    chatter(1, true, 5, 5, [], [
      makeDialog(10, 'A', ago(100), 1, 'Stella', '💃'),
      makeDialog(11, 'B', ago(30), 2, 'Mia', '🌸'),
      makeDialog(30, 'D', null, 1, 'Stella', '💃'),
    ]),
    chatter(2, true, 5, 3, [], [
      makeDialog(20, 'C', ago(200), 2, 'Mia', '🌸'),
    ]),
  ]

  it('assigns correct 3-way status per dialog', () => {
    const rows = buildOverdueQueue(chatters, NOW, 60)
    const byId = Object.fromEntries(rows.map((r) => [r.conversation_id, r]))
    expect(byId[20].status).toBe('overdue')
    expect(byId[10].status).toBe('overdue')
    expect(byId[11].status).toBe('unanswered')
    expect(byId[30].status).toBe('ok')
  })

  it('sorts overdue→unanswered→ok; within overdue/unanswered oldest-first; within ok by fan_name', () => {
    const rows = buildOverdueQueue(chatters, NOW, 60)
    expect(rows.map((r) => r.conversation_id)).toEqual([20, 10, 11, 30])
  })

  it('carries embedded model info from dialogs[]', () => {
    const rows = buildOverdueQueue(chatters, NOW, 60)
    const byId = Object.fromEntries(rows.map((r) => [r.conversation_id, r]))
    expect(byId[20].model_name).toBe('Mia')
    expect(byId[10].model_name).toBe('Stella')
  })

  it('waiting_since is null for ok-status rows', () => {
    const rows = buildOverdueQueue(chatters, NOW, 60)
    const ok = rows.find((r) => r.conversation_id === 30)!
    expect(ok.waiting_since).toBeNull()
  })

  it('returns empty list when no chatters have any dialogs', () => {
    const empty = [chatter(1, true, 5, 0, [], [])]
    const rows = buildOverdueQueue(empty, NOW, 60)
    expect(rows).toHaveLength(0)
  })

  it('sorts ok rows alphabetically by fan_name', () => {
    const chattersOkOnly: ChatterStatus[] = [
      chatter(1, true, 5, 3, [], [
        makeDialog(1, 'Zara', null),
        makeDialog(2, 'Anna', null),
        makeDialog(3, 'Mike', null),
      ]),
    ]
    const rows = buildOverdueQueue(chattersOkOnly, NOW, 60)
    expect(rows.map((r) => r.fan_name)).toEqual(['Anna', 'Mike', 'Zara'])
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
