import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { send } from '@/services/ws'
import type { Message, OptimisticMessage, MessagesPageResponse } from '@/types/contracts'

interface ConvState {
  hasMore: boolean
}

export const useMessagesStore = defineStore('messages', () => {
  // Real messages indexed by id
  const byId = ref<Record<number, Message>>({})
  // Optimistic (unconfirmed) messages indexed by client_msg_id
  const optimistic = ref<Record<string, OptimisticMessage>>({})
  // Per-conversation pagination state
  const convState = ref<Record<number, ConvState>>({})

  // Non-critical server error detail shown as an in-dialog banner (no client_msg_id)
  const globalError = ref<string | null>(null)

  const maxId = computed<number>(() => {
    const ids = Object.keys(byId.value).map(Number)
    return ids.length > 0 ? Math.max(...ids) : 0
  })

  function getMessages(conversationId: number): (Message | OptimisticMessage)[] {
    const real = Object.values(byId.value)
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => a.id - b.id)
    const opt = Object.values(optimistic.value)
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return [...real, ...opt]
  }

  function hasMore(conversationId: number): boolean {
    return convState.value[conversationId]?.hasMore ?? false
  }

  function minIdForConversation(conversationId: number): number | null {
    const ids = Object.values(byId.value)
      .filter((m) => m.conversation_id === conversationId)
      .map((m) => m.id)
    return ids.length > 0 ? Math.min(...ids) : null
  }

  // Load initial (newest) messages for a conversation
  async function loadMessages(conversationId: number) {
    const res = await api.get<MessagesPageResponse>(
      `/api/conversations/${conversationId}/messages/`,
    )
    for (const msg of res.results) {
      byId.value[msg.id] = msg
    }
    convState.value[conversationId] = { hasMore: res.has_more }
  }

  // Load older messages (scroll up)
  async function loadOlderMessages(conversationId: number) {
    const minId = minIdForConversation(conversationId)
    if (minId === null) return

    const res = await api.get<MessagesPageResponse>(
      `/api/conversations/${conversationId}/messages/?before_id=${minId}`,
    )

    // Track scroll anchor before merging (component will read old minId to restore position)
    for (const msg of res.results) {
      byId.value[msg.id] = msg
    }
    convState.value[conversationId] = { hasMore: res.has_more }
  }

  function applyMessageNew(message: Message) {
    byId.value[message.id] = message
    // Remove optimistic entry if matched by client_msg_id
    if (message.client_msg_id && optimistic.value[message.client_msg_id]) {
      delete optimistic.value[message.client_msg_id]
    }
  }

  function mergeSync(messages: Message[]) {
    for (const msg of messages) {
      byId.value[msg.id] = msg
      // Prune optimistic twin if already confirmed server-side
      if (msg.client_msg_id && optimistic.value[msg.client_msg_id]) {
        delete optimistic.value[msg.client_msg_id]
      }
    }
  }

  function addOptimistic(msg: OptimisticMessage) {
    optimistic.value[msg.client_msg_id] = msg
  }

  function resendPending() {
    for (const msg of Object.values(optimistic.value)) {
      // Failed messages are excluded from automatic resend; user retries them manually
      if (msg.failed) continue
      const payload: Record<string, unknown> = {
        conversation_id: msg.conversation_id,
        text: msg.text,
        kind: msg.kind,
        client_msg_id: msg.client_msg_id,
      }
      if (msg.ppv_price !== null) {
        payload.ppv_price = parseFloat(msg.ppv_price)
      }
      send({ type: 'message.send', payload })
    }
  }

  /** Mark a pending message as failed with the server-supplied detail. */
  function markFailed(client_msg_id: string, detail: string) {
    const msg = optimistic.value[client_msg_id]
    if (!msg) return
    optimistic.value[client_msg_id] = { ...msg, failed: true, error_detail: detail }
  }

  /** Reset a failed message to pending and resend it (same client_msg_id). */
  function retryMessage(client_msg_id: string) {
    const msg = optimistic.value[client_msg_id]
    if (!msg || !msg.failed) return
    // Remove failed / error_detail by spreading without them
    const retried: OptimisticMessage = { ...msg, failed: undefined, error_detail: undefined }
    delete retried.failed
    delete retried.error_detail
    optimistic.value[client_msg_id] = retried
    const payload: Record<string, unknown> = {
      conversation_id: msg.conversation_id,
      text: msg.text,
      kind: msg.kind,
      client_msg_id: msg.client_msg_id,
    }
    if (msg.ppv_price !== null) {
      payload.ppv_price = parseFloat(msg.ppv_price)
    }
    send({ type: 'message.send', payload })
  }

  function setGlobalError(detail: string) {
    globalError.value = detail
  }

  function clearGlobalError() {
    globalError.value = null
  }

  function clearConversation(conversationId: number) {
    for (const id of Object.keys(byId.value).map(Number)) {
      if (byId.value[id]?.conversation_id === conversationId) {
        delete byId.value[id]
      }
    }
    delete convState.value[conversationId]
  }

  return {
    byId,
    optimistic,
    convState,
    globalError,
    maxId,
    getMessages,
    hasMore,
    minIdForConversation,
    loadMessages,
    loadOlderMessages,
    applyMessageNew,
    mergeSync,
    addOptimistic,
    resendPending,
    markFailed,
    retryMessage,
    setGlobalError,
    clearGlobalError,
    clearConversation,
  }
})
