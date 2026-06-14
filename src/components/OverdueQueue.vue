<script setup lang="ts">
import { computed } from 'vue'
import { useMonitorStore, buildOverdueQueue, formatWaitDuration } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { now } from '@/composables/useTicker'

const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const rows = computed(() =>
  buildOverdueQueue(
    monitorStore.sortedChatters,
    monitorStore.sortedModels,
    now.value,
    authStore.config.overdue_seconds,
  ),
)
</script>

<template>
  <div class="queue-wrap">
    <h2 class="queue-title">Очередь ожидания</h2>

    <div v-if="rows.length === 0" class="queue-empty">
      Очередь пуста
    </div>

    <div v-else class="queue-list">
      <div
        v-for="row in rows"
        :key="row.conversation_id"
        class="queue-row"
        :class="{ 'queue-row--overdue': row.overdue }"
      >
        <div class="queue-left">
          <span class="queue-fan">{{ row.fan_name }}</span>
          <span class="queue-sep">·</span>
          <span class="queue-chatter">{{ row.chatter_name }}</span>
          <template v-if="row.model_name">
            <span class="queue-arrow">→</span>
            <span class="queue-model">
              <span v-if="row.model_avatar" class="queue-model-avatar">{{ row.model_avatar }}</span>
              {{ row.model_name }}
            </span>
          </template>
        </div>
        <div class="queue-right">
          <span class="queue-timer">{{ formatWaitDuration(row.waiting_since, now) }}</span>
          <span v-if="row.overdue" class="overdue-tag">ПРОСРОЧЕНО</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.queue-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.queue-empty {
  color: var(--text-muted);
  font-size: 0.875rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.queue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.875rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: background 0.15s;
  gap: 1rem;
}

.queue-row:hover {
  background: var(--bg-hover);
}

.queue-row--overdue {
  background: var(--overdue-bg);
  border-color: var(--overdue-border);
}

.queue-row--overdue:hover {
  background: var(--overdue-bg);
}

.queue-left {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.queue-fan {
  font-weight: 600;
  color: var(--text-primary);
}

.queue-sep {
  color: var(--text-muted);
}

.queue-chatter {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.queue-arrow {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.queue-model {
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.queue-model-avatar {
  font-size: 1rem;
}

.queue-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.queue-timer {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.overdue-tag {
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--danger);
  color: #fff;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
</style>
