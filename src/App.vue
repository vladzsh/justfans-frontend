<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useConversationsStore } from '@/stores/conversations'
import { useMessagesStore } from '@/stores/messages'
import { useMonitorStore } from '@/stores/monitor'
import { connect, disconnect, on, off, setHeartbeatSeconds } from '@/services/ws'
import { startTicker } from '@/composables/useTicker'
import { api } from '@/services/api'
import WsIndicator from '@/components/WsIndicator.vue'
import type { MessageNewPayload, ConversationReadPayload, ChatterStatus, SyncResponse } from '@/types/contracts'

const authStore = useAuthStore()
const conversationsStore = useConversationsStore()
const messagesStore = useMessagesStore()
const monitorStore = useMonitorStore()
const router = useRouter()

const stopTicker = startTicker()

// Subscribe BEFORE firing sync so racing live events are deduped
async function handleConnected() {
  if (!authStore.user) return

  if (authStore.user.role === 'chatter') {
    try {
      const afterId = messagesStore.maxId
      const syncData = await api.get<SyncResponse>(`/api/sync/?after_id=${afterId}`)
      messagesStore.mergeSync(syncData.messages)
      conversationsStore.setAll(syncData.conversations)
      messagesStore.resendPending()
    } catch {
      // non-fatal; live events will catch up
    }
  } else if (authStore.user.role === 'teamlead') {
    monitorStore.loadSnapshot().catch(() => {})
  }
}

function handleMessageNew(payload: unknown) {
  const { message, conversation } = payload as MessageNewPayload
  messagesStore.applyMessageNew(message)
  conversationsStore.upsert(conversation)
  // Auto mark-read when the conversation is currently open
  if (conversationsStore.activeId === message.conversation_id) {
    conversationsStore.markRead(message.conversation_id).catch(() => {})
  }
}

function handleConversationRead(payload: unknown) {
  const { conversation_id } = payload as ConversationReadPayload
  // Sync tab: another tab already called mark-read
  conversationsStore.resetUnread(conversation_id)
}

function handleMonitorUpdate(payload: unknown) {
  monitorStore.applyUpdate(payload as ChatterStatus)
}

on('connected', handleConnected)
on('message.new', handleMessageNew)
on('conversation.read', handleConversationRead)
on('monitor.update', handleMonitorUpdate)

watch(
  () => authStore.user,
  (user) => {
    if (user) {
      setHeartbeatSeconds(authStore.config.heartbeat_seconds)
      connect()
    } else if (authStore.initialized) {
      // Only redirect on real logout; skip the pre-init null on first load
      // (the router guard handles unauthenticated access during init)
      disconnect()
      router.push('/login')
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  off('connected', handleConnected)
  off('message.new', handleMessageNew)
  off('conversation.read', handleConversationRead)
  off('monitor.update', handleMonitorUpdate)
  stopTicker()
})
</script>

<template>
  <WsIndicator />
  <router-view />
</template>
