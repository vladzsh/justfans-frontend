import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConversationsStore } from '@/stores/conversations'
import { useMonitorStore, calcIsOffline, calcIsOverdue } from '@/stores/monitor'
import { now } from '@/composables/useTicker'
import type { Conversation, ChatterStatus } from '@/types/contracts'

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function makeConversation(id: number, unread = 0, awaiting: string | null = null): Conversation {
  return {
    id,
    fan: { id: id, name: `Fan ${id}`, avatar: '🧔' },
    model: { id: 1, name: 'Stella', avatar: '💃' },
    last_message: { text: 'hello', sender: 'fan', created_at: new Date().toISOString() },
    last_message_at: new Date().toISOString(),
    unread_count: unread,
    awaiting_reply_since: awaiting,
  }
}

function makeChatter(
  id: number,
  connected: boolean,
  lastSeenMs: number,
  waiting: { conversation_id: number; fan_name: string; waiting_since: string }[] = [],
): ChatterStatus {
  return {
    id,
    display_name: `Chatter ${id}`,
    connected,
    last_seen: new Date(lastSeenMs).toISOString(),
    dialogs_count: 3,
    waiting,
  }
}

describe('conversations store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('increments unread via upsert', () => {
    const store = useConversationsStore()
    store.upsert(makeConversation(1, 0))
    store.upsert(makeConversation(1, 3))
    expect(store.byId[1].unread_count).toBe(3)
  })

  it('resets unread on resetUnread', () => {
    const store = useConversationsStore()
    store.upsert(makeConversation(1, 5))
    store.resetUnread(1)
    expect(store.byId[1].unread_count).toBe(0)
  })

  it('updates preview on upsert (last_message)', () => {
    const store = useConversationsStore()
    store.upsert(makeConversation(1))
    const updated = makeConversation(1)
    updated.last_message = { text: 'new message', sender: 'fan', created_at: new Date().toISOString() }
    store.upsert(updated)
    expect(store.byId[1].last_message?.text).toBe('new message')
  })

  it('sorts conversations by last_message_at desc', () => {
    const store = useConversationsStore()
    const older = makeConversation(1)
    older.last_message_at = new Date(1000).toISOString()
    const newer = makeConversation(2)
    newer.last_message_at = new Date(2000).toISOString()
    store.upsert(older)
    store.upsert(newer)
    expect(store.sorted[0].id).toBe(2)
    expect(store.sorted[1].id).toBe(1)
  })

  it('setAll overwrites existing conversations by id', () => {
    const store = useConversationsStore()
    store.upsert(makeConversation(1, 5))
    store.setAll([makeConversation(1, 0), makeConversation(2, 2)])
    expect(store.byId[1].unread_count).toBe(0)
    expect(store.byId[2].unread_count).toBe(2)
  })
})

describe('monitor store — offline and overdue via calcIs* pure functions', () => {
  const BASE_TIME = 1_700_000_000_000

  beforeEach(() => {
    setActivePinia(createPinia())
    now.value = BASE_TIME
  })

  it('calcIsOffline returns false when connected=true', () => {
    expect(calcIsOffline(true, new Date(BASE_TIME - 60_000).toISOString(), BASE_TIME, 30)).toBe(false)
  })

  it('calcIsOffline returns false when disconnected but within grace period', () => {
    expect(calcIsOffline(false, new Date(BASE_TIME - 10_000).toISOString(), BASE_TIME, 30)).toBe(false)
  })

  it('calcIsOffline returns true when disconnected and past grace period', () => {
    expect(calcIsOffline(false, new Date(BASE_TIME - 31_000).toISOString(), BASE_TIME, 30)).toBe(true)
  })

  it('calcIsOverdue returns false before threshold', () => {
    expect(calcIsOverdue(new Date(BASE_TIME - 60_000).toISOString(), BASE_TIME, 120)).toBe(false)
  })

  it('calcIsOverdue returns true after threshold', () => {
    expect(calcIsOverdue(new Date(BASE_TIME - 121_000).toISOString(), BASE_TIME, 120)).toBe(true)
  })

  it('monitor store applyUpdate merges single chatter by id', () => {
    const store = useMonitorStore()
    store.applyUpdate(makeChatter(1, true, BASE_TIME))
    store.applyUpdate(makeChatter(2, false, BASE_TIME - 5_000))
    expect(Object.keys(store.chatters).length).toBe(2)
    // Update chatter 1
    store.applyUpdate(makeChatter(1, false, BASE_TIME - 1_000))
    expect(Object.keys(store.chatters).length).toBe(2)
    expect(store.chatters[1].connected).toBe(false)
  })

  it('overdue count: isOverdue respects now ref', () => {
    // waiting_since = BASE_TIME - 50s, overdue threshold = 120s → NOT overdue
    const waitingSince = new Date(BASE_TIME - 50_000).toISOString()
    expect(calcIsOverdue(waitingSince, BASE_TIME, 120)).toBe(false)

    // advance clock 80 seconds → total 130s > 120s → overdue
    const laterNow = BASE_TIME + 80_000
    expect(calcIsOverdue(waitingSince, laterNow, 120)).toBe(true)
  })

  it('monitor store isOffline uses now ref from useTicker', () => {
    const store = useMonitorStore()
    const chatter = makeChatter(1, false, BASE_TIME - 10_000)
    store.applyUpdate(chatter)

    // Within grace period (10s < 30s)
    now.value = BASE_TIME
    expect(store.isOffline(chatter, 30)).toBe(false)

    // Advance past grace period
    now.value = BASE_TIME + 25_000
    expect(store.isOffline(chatter, 30)).toBe(true)
  })
})
