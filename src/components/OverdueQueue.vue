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
    now.value,
    authStore.config.overdue_seconds,
  ),
)
</script>

<template>
  <div class="queue-wrap">
    <h2 class="queue-title">Очередь</h2>

    <div v-if="rows.length === 0" class="queue-empty">
      Нет диалогов
    </div>

    <div v-else class="queue-list">
      <div
        v-for="row in rows"
        :key="row.conversation_id"
        class="queue-row"
        :class="{
          'queue-row--overdue': row.status === 'overdue',
          'queue-row--unanswered': row.status === 'unanswered',
          'queue-row--ok': row.status === 'ok',
        }"
      >
        <div class="queue-left">
          <span
            class="status-badge"
            :class="{
              'status-badge--overdue': row.status === 'overdue',
              'status-badge--unanswered': row.status === 'unanswered',
              'status-badge--ok': row.status === 'ok',
            }"
          >
            <template v-if="row.status === 'overdue'">просрочено</template>
            <template v-else-if="row.status === 'unanswered'">без ответа</template>
            <template v-else>ОК</template>
          </span>
          <span class="queue-fan">{{ row.fan_name }}</span>
          <span class="queue-sep">·</span>
          <span class="queue-chatter">{{ row.chatter_name }}</span>
          <span class="queue-arrow">→</span>
          <span class="queue-model">
            <span v-if="row.model_avatar" class="queue-model-avatar">{{ row.model_avatar }}</span>
            {{ row.model_name }}
          </span>
        </div>
        <div class="queue-right">
          <span class="queue-timer">
            {{ row.waiting_since ? formatWaitDuration(row.waiting_since, now) : '—' }}
          </span>
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

.status-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.status-badge--overdue {
  background: var(--danger);
  color: #fff;
}

.status-badge--unanswered {
  background: var(--warning, #e6a817);
  color: #fff;
}

.status-badge--ok {
  background: var(--success, #2ea44f);
  color: #fff;
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
</style>
