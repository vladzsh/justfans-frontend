import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMessagesStore } from '@/stores/messages'
import { send } from '@/services/ws'
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

describe('messages store — failed state and resend exclusion', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(send).mockClear()
  })

  function makeOptimistic(clientId: string) {
    return {
      client_msg_id: clientId,
      conversation_id: 1,
      sender: 'chatter' as const,
      kind: 'text' as const,
      text: `msg ${clientId}`,
      ppv_price: null,
      created_at: new Date().toISOString(),
      pending: true as const,
    }
  }

  it('markFailed sets failed flag and error_detail on the optimistic message', () => {
    const store = useMessagesStore()
    store.addOptimistic(makeOptimistic('id-1'))

    store.markFailed('id-1', 'Permission denied')

    expect(store.optimistic['id-1'].failed).toBe(true)
    expect(store.optimistic['id-1'].error_detail).toBe('Permission denied')
  })

  it('markFailed is a no-op for unknown client_msg_id', () => {
    const store = useMessagesStore()
    expect(() => store.markFailed('non-existent', 'err')).not.toThrow()
  })

  it('resendPending skips failed messages and only sends pending ones', () => {
    const store = useMessagesStore()
    store.addOptimistic(makeOptimistic('pending-1'))
    store.addOptimistic(makeOptimistic('failed-1'))
    store.markFailed('failed-1', 'Bad request')

    store.resendPending()

    expect(vi.mocked(send)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(send)).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ client_msg_id: 'pending-1' }),
      }),
    )
  })

  it('resendPending sends all messages when none are failed', () => {
    const store = useMessagesStore()
    store.addOptimistic(makeOptimistic('p-1'))
    store.addOptimistic(makeOptimistic('p-2'))

    store.resendPending()

    expect(vi.mocked(send)).toHaveBeenCalledTimes(2)
  })

  it('retryMessage resets failed status and resends the message', () => {
    const store = useMessagesStore()
    store.addOptimistic(makeOptimistic('retry-1'))
    store.markFailed('retry-1', 'Some error')
    expect(store.optimistic['retry-1'].failed).toBe(true)

    store.retryMessage('retry-1')

    expect(store.optimistic['retry-1'].failed).toBeUndefined()
    expect(store.optimistic['retry-1'].error_detail).toBeUndefined()
    expect(vi.mocked(send)).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ client_msg_id: 'retry-1' }),
      }),
    )
  })
})
