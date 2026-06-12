import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMessagesStore } from '@/stores/messages'
import type { Message } from '@/types/contracts'

// Prevent actual API calls from the store's async actions
vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/services/ws', () => ({
  send: vi.fn(),
}))

function makeMessage(id: number, conversationId = 1, clientMsgId: string | null = null): Message {
  return {
    id,
    conversation_id: conversationId,
    sender: 'fan',
    kind: 'text',
    text: `msg ${id}`,
    ppv_price: null,
    client_msg_id: clientMsgId,
    created_at: new Date(id * 1000).toISOString(),
  }
}

describe('messages store — dedup and ordering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('deduplicates messages by id during mergeSync', () => {
    const store = useMessagesStore()
    store.mergeSync([makeMessage(1), makeMessage(2), makeMessage(1)])
    const msgs = store.getMessages(1)
    expect(msgs.length).toBe(2)
    expect(msgs.map((m) => (m as Message).id)).toEqual([1, 2])
  })

  it('orders messages by id ascending', () => {
    const store = useMessagesStore()
    store.mergeSync([makeMessage(5), makeMessage(2), makeMessage(8), makeMessage(3)])
    const ids = store.getMessages(1).map((m) => (m as Message).id)
    expect(ids).toEqual([2, 3, 5, 8])
  })

  it('deduplicates when merging pagination page with live messages', () => {
    const store = useMessagesStore()
    // Simulate live message arriving via WS
    store.applyMessageNew(makeMessage(10))
    // Now a pagination page arrives that includes the same message
    store.mergeSync([makeMessage(8), makeMessage(9), makeMessage(10)])
    const msgs = store.getMessages(1)
    expect(msgs.length).toBe(3)
    const ids = msgs.map((m) => (m as Message).id)
    expect(ids).toEqual([8, 9, 10])
  })

  it('removes optimistic message when confirmed by message.new with matching client_msg_id', () => {
    const store = useMessagesStore()
    const clientId = 'test-uuid-123'
    store.addOptimistic({
      client_msg_id: clientId,
      conversation_id: 1,
      sender: 'chatter',
      kind: 'text',
      text: 'hello',
      ppv_price: null,
      created_at: new Date().toISOString(),
      pending: true,
    })
    expect(store.optimistic[clientId]).toBeDefined()

    store.applyMessageNew(makeMessage(42, 1, clientId))
    expect(store.optimistic[clientId]).toBeUndefined()
    expect(store.byId[42]).toBeDefined()
  })

  it('keeps real and optimistic messages in separate keys', () => {
    const store = useMessagesStore()
    store.mergeSync([makeMessage(1), makeMessage(2)])
    store.addOptimistic({
      client_msg_id: 'opt-1',
      conversation_id: 1,
      sender: 'chatter',
      kind: 'text',
      text: 'pending',
      ppv_price: null,
      created_at: new Date().toISOString(),
      pending: true,
    })
    const msgs = store.getMessages(1)
    // 2 real + 1 optimistic
    expect(msgs.length).toBe(3)
  })

  it('maxId reflects the highest real message id', () => {
    const store = useMessagesStore()
    expect(store.maxId).toBe(0)
    store.mergeSync([makeMessage(5), makeMessage(3), makeMessage(10)])
    expect(store.maxId).toBe(10)
  })

  it('does not mix messages from different conversations', () => {
    const store = useMessagesStore()
    store.mergeSync([makeMessage(1, 1), makeMessage(2, 2), makeMessage(3, 1)])
    expect(store.getMessages(1).length).toBe(2)
    expect(store.getMessages(2).length).toBe(1)
  })
})
