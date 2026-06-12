import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { Conversation } from '@/types/contracts'

export const useConversationsStore = defineStore('conversations', () => {
  const byId = ref<Record<number, Conversation>>({})
  const activeId = ref<number | null>(null)

  const sorted = computed<Conversation[]>(() =>
    Object.values(byId.value).sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return tb - ta
    }),
  )

  async function load() {
    const list = await api.get<Conversation[]>('/api/conversations/')
    byId.value = {}
    for (const c of list) {
      byId.value[c.id] = c
    }
  }

  function upsert(conversation: Conversation) {
    byId.value[conversation.id] = conversation
  }

  function setAll(conversations: Conversation[]) {
    for (const c of conversations) {
      byId.value[c.id] = c
    }
  }

  function resetUnread(conversationId: number) {
    const c = byId.value[conversationId]
    if (c) {
      byId.value[conversationId] = { ...c, unread_count: 0 }
    }
  }

  async function markRead(conversationId: number) {
    resetUnread(conversationId)
    await api.post(`/api/conversations/${conversationId}/read/`)
  }

  function setActive(id: number | null) {
    activeId.value = id
  }

  return { byId, activeId, sorted, load, upsert, setAll, resetUnread, markRead, setActive }
})
