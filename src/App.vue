<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useConversationsStore } from '@/stores/conversations'
import { useMessagesStore } from '@/stores/messages'
import { connect, disconnect, on, off, setHeartbeatSeconds } from '@/services/ws'
import { startTicker } from '@/composables/useTicker'
import { api } from '@/services/api'
import WsIndicator from '@/components/WsIndicator.vue'
import type { SyncResponse } from '@/types/contracts'

const authStore = useAuthStore()
const conversationsStore = useConversationsStore()
const messagesStore = useMessagesStore()
const router = useRouter()

const stopTicker = startTicker()

// Subscribe BEFORE firing sync so racing live events are deduped
async function handleConnected() {
  if (!authStore.user || authStore.user.role !== 'chatter') return
  try {
    const afterId = messagesStore.maxId
    const syncData = await api.get<SyncResponse>(`/api/sync/?after_id=${afterId}`)
    messagesStore.mergeSync(syncData.messages)
    conversationsStore.setAll(syncData.conversations)
    messagesStore.resendPending()
  } catch {
    // non-fatal; live events will catch up
  }
}

on('connected', handleConnected)

watch(
  () => authStore.user,
  (user) => {
    if (user) {
      setHeartbeatSeconds(authStore.config.heartbeat_seconds)
      connect()
    } else {
      disconnect()
      router.push('/login')
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  off('connected', handleConnected)
  stopTicker()
})
</script>

<template>
  <WsIndicator />
  <router-view />
</template>
