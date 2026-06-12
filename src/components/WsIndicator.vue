<script setup lang="ts">
import { wsStatus } from '@/services/ws'
</script>

<template>
  <div class="ws-indicator" :class="`ws-indicator--${wsStatus}`">
    <span class="ws-dot" />
    <span class="ws-label">
      <template v-if="wsStatus === 'connected'">Онлайн</template>
      <template v-else-if="wsStatus === 'connecting'">Подключение...</template>
      <template v-else>Офлайн</template>
    </span>
  </div>
</template>

<style scoped>
.ws-indicator {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  z-index: 100;
  transition: all 0.2s;
}

.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.ws-indicator--connected .ws-dot {
  background: var(--success);
}

.ws-indicator--connecting .ws-dot {
  background: var(--warning);
  animation: pulse 1s infinite;
}

.ws-indicator--disconnected .ws-dot {
  background: var(--danger);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
