<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { connect, disconnect, setHeartbeatSeconds } from '@/services/ws'
import { startTicker } from '@/composables/useTicker'
import WsIndicator from '@/components/WsIndicator.vue'

const authStore = useAuthStore()
const stopTicker = startTicker()

watch(
  () => authStore.user,
  (user) => {
    if (user) {
      setHeartbeatSeconds(authStore.config.heartbeat_seconds)
      connect()
    } else {
      disconnect()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  stopTicker()
})
</script>

<template>
  <WsIndicator />
  <router-view />
</template>
