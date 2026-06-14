import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConversationsStore } from '@/stores/conversations'
import { useMonitorStore, calcIsOffline, calcIsOverdue } from '@/stores/monitor'
import { now } from '@/composables/useTicker'
import { api } from '@/services/api'
import type { Conversation, ChatterStatus, ModelStatus, MonitorSnapshot } from '@/types/contracts'

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
    dialogs: [],
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

  it('calcIsOffline returns true when connected=true but last_seen is stale (BUG-1 regression)', () => {
    // connected=true must NOT prevent offline when last_seen is stale
    expect(calcIsOffline(true, new Date(BASE_TIME - 60_000).toISOString(), BASE_TIME, 30)).toBe(true)
  })

  it('calcIsOffline returns false when connected and last_seen is within grace period', () => {
    expect(calcIsOffline(true, new Date(BASE_TIME - 10_000).toISOString(), BASE_TIME, 30)).toBe(false)
  })

  it('calcIsOffline returns true when connected but last_seen is past grace period', () => {
    expect(calcIsOffline(true, new Date(BASE_TIME - 31_000).toISOString(), BASE_TIME, 30)).toBe(true)
  })

  it('calcIsOffline returns true immediately when connected=false (clean disconnect fast path)', () => {
    // Even with a fresh last_seen, a reported disconnect means offline now
    expect(calcIsOffline(false, new Date(BASE_TIME - 1_000).toISOString(), BASE_TIME, 30)).toBe(true)
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
    const chatter = makeChatter(1, true, BASE_TIME - 10_000)
    store.applyUpdate(chatter)

    // Within grace period (10s < 30s)
    now.value = BASE_TIME
    expect(store.isOffline(chatter, 30)).toBe(false)

    // Advance past grace period
    now.value = BASE_TIME + 25_000
    expect(store.isOffline(chatter, 30)).toBe(true)
  })

  it('frozen chatter: connected=true but stale last_seen → offline (BUG-1 regression)', () => {
    const store = useMonitorStore()
    // last_seen = BASE_TIME - 35s (older than grace=30s), connected=true (silent drop, no disconnect)
    const chatter = makeChatter(1, true, BASE_TIME - 35_000)
    store.applyUpdate(chatter)
    now.value = BASE_TIME
    expect(store.isOffline(chatter, 30)).toBe(true)
  })

  it('live chatter: presence.update refreshes last_seen → stays online past grace', () => {
    const store = useMonitorStore()
    // initial last_seen = BASE_TIME, connected=true
    const chatter = makeChatter(1, true, BASE_TIME)
    store.applyUpdate(chatter)

    // advance time past grace (35s), but update last_seen via presence.update
    now.value = BASE_TIME + 35_000
    const freshLastSeen = new Date(BASE_TIME + 35_000).toISOString()
    store.applyPresenceUpdate(1, freshLastSeen)

    // last_seen is now fresh (diff = 0) → not offline
    expect(store.isOffline(store.chatters[1], 30)).toBe(false)
  })

  it('applyPresenceUpdate updates only last_seen, not connected or dialogs_count', () => {
    const store = useMonitorStore()
    const chatter = makeChatter(1, true, BASE_TIME, [
      { conversation_id: 42, fan_name: 'Fan', waiting_since: new Date(BASE_TIME).toISOString() },
    ])
    store.applyUpdate(chatter)

    const newLastSeen = new Date(BASE_TIME + 10_000).toISOString()
    store.applyPresenceUpdate(1, newLastSeen)

    expect(store.chatters[1].last_seen).toBe(newLastSeen)
    expect(store.chatters[1].connected).toBe(true)
    expect(store.chatters[1].dialogs_count).toBe(3)
    expect(store.chatters[1].waiting).toHaveLength(1)
  })

  it('applyPresenceUpdate is a no-op for unknown chatter id', () => {
    const store = useMonitorStore()
    store.applyPresenceUpdate(999, new Date(BASE_TIME).toISOString())
    expect(Object.keys(store.chatters)).toHaveLength(0)
  })
})

function makeModel(
  id: number,
  name: string,
  waiting: { conversation_id: number; fan_name: string; waiting_since: string }[] = [],
  dialogs_count = 0,
): ModelStatus {
  return { id, name, avatar: '💃', dialogs_count, waiting }
}

describe('monitor store — models panel', () => {
  const BASE_TIME = 1_700_000_000_000

  beforeEach(() => {
    setActivePinia(createPinia())
    now.value = BASE_TIME
  })

  it('loadSnapshot populates models from snap.models', async () => {
    const snapshot: MonitorSnapshot = {
      chatters: [],
      models: [
        makeModel(1, 'Stella', [], 3),
        makeModel(2, 'Luna', [{ conversation_id: 5, fan_name: 'Mark', waiting_since: new Date(BASE_TIME - 10_000).toISOString() }], 2),
      ],
    }
    vi.mocked(api.get).mockResolvedValueOnce(snapshot)
    const store = useMonitorStore()
    await store.loadSnapshot()
    expect(Object.keys(store.models)).toHaveLength(2)
    expect(store.models[1].name).toBe('Stella')
    expect(store.models[2].waiting).toHaveLength(1)
  })

  it('loadSnapshot: model with 0 waiting is still present', async () => {
    const snapshot: MonitorSnapshot = {
      chatters: [],
      models: [makeModel(3, 'Violet', [], 0)],
    }
    vi.mocked(api.get).mockResolvedValueOnce(snapshot)
    const store = useMonitorStore()
    await store.loadSnapshot()
    expect(store.models[3]).toBeDefined()
    expect(store.models[3].waiting).toHaveLength(0)
    expect(store.models[3].dialogs_count).toBe(0)
  })

  it('applyModelsUpdate replaces the entire models set', () => {
    const store = useMonitorStore()
    store.applyModelsUpdate([makeModel(1, 'Stella', [], 5), makeModel(2, 'Luna', [], 3)])
    expect(Object.keys(store.models)).toHaveLength(2)

    // Replace with a different set
    store.applyModelsUpdate([makeModel(3, 'Nova', [], 1)])
    expect(Object.keys(store.models)).toHaveLength(1)
    expect(store.models[3].name).toBe('Nova')
    expect(store.models[1]).toBeUndefined()
  })

  it('sortedModels is sorted alphabetically by name', () => {
    const store = useMonitorStore()
    store.applyModelsUpdate([makeModel(1, 'Zara'), makeModel(2, 'Anna'), makeModel(3, 'Mia')])
    const names = store.sortedModels.map((m) => m.name)
    expect(names).toEqual(['Anna', 'Mia', 'Zara'])
  })

  it('per-model overdue count uses calcIsOverdue correctly', () => {
    const waitingSince = new Date(BASE_TIME - 130_000).toISOString() // 130s ago
    const model = makeModel(1, 'Stella', [
      { conversation_id: 1, fan_name: 'Fan A', waiting_since: waitingSince },
      { conversation_id: 2, fan_name: 'Fan B', waiting_since: new Date(BASE_TIME - 50_000).toISOString() },
    ], 2)
    const overdueCount = model.waiting.filter((d) => calcIsOverdue(d.waiting_since, BASE_TIME, 120)).length
    expect(overdueCount).toBe(1) // only Fan A is overdue (130s > 120s), Fan B is not (50s < 120s)
  })

  it('applyModelsUpdate with empty array clears all models', () => {
    const store = useMonitorStore()
    store.applyModelsUpdate([makeModel(1, 'Stella')])
    store.applyModelsUpdate([])
    expect(Object.keys(store.models)).toHaveLength(0)
  })
})
