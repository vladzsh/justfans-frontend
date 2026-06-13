<script setup lang="ts">
import { computed } from 'vue'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { now } from '@/composables/useTicker'
import { calcIsOverdue } from '@/stores/monitor'
import type { ModelStatus, WaitingDialog } from '@/types/contracts'

const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const config = computed(() => authStore.config)

function isOverdue(dialog: WaitingDialog): boolean {
  return calcIsOverdue(dialog.waiting_since, now.value, config.value.overdue_seconds)
}

function overdueCount(model: ModelStatus): number {
  return model.waiting.filter((d) => isOverdue(d)).length
}

function waitingDuration(since: string): string {
  const diffMs = now.value - new Date(since).getTime()
  const totalSec = Math.floor(diffMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min + ':' + String(sec).padStart(2, '0')
}
</script>

<template>
  <div class="monitor-wrap">
    <h2 class="monitor-title">Модели ({{ monitorStore.sortedModels.length }})</h2>

    <div v-if="monitorStore.sortedModels.length === 0" class="monitor-empty">
      Нет данных
    </div>

    <table v-else class="monitor-table">
      <thead>
        <tr>
          <th>Модель</th>
          <th>Диалогов</th>
          <th>Ожидают</th>
          <th>Просрочено</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="model in monitorStore.sortedModels"
          :key="model.id"
        >
          <td class="td-name">{{ model.avatar }} {{ model.name }}</td>
          <td class="td-count">{{ model.dialogs_count }}</td>
          <td class="td-count">
            <span v-if="model.waiting.length > 0">{{ model.waiting.length }}</span>
            <span v-else class="text-muted">—</span>
          </td>
          <td class="td-count">
            <span v-if="overdueCount(model) > 0" class="overdue-count">
              {{ overdueCount(model) }}
            </span>
            <span v-else class="text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-for="model in monitorStore.sortedModels.filter((m) => m.waiting.length > 0)"
      :key="`waiting-${model.id}`"
      class="waiting-section"
    >
      <h3 class="waiting-section-title">{{ model.avatar }} {{ model.name }} — ожидают ответа</h3>
      <div
        v-for="dialog in model.waiting"
        :key="dialog.conversation_id"
        class="waiting-row"
        :class="{ 'waiting-row--overdue': isOverdue(dialog) }"
      >
        <span class="waiting-fan">{{ dialog.fan_name }}</span>
        <span class="waiting-timer">{{ waitingDuration(dialog.waiting_since) }}</span>
        <span v-if="isOverdue(dialog)" class="overdue-tag">ПРОСРОЧЕНО</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.monitor-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.monitor-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.monitor-empty {
  color: var(--text-muted);
}

.monitor-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.monitor-table th {
  padding: 0.625rem 1rem;
  text-align: left;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
}

.monitor-table td {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--border);
}

.monitor-table tr:last-child td {
  border-bottom: none;
}

.td-name {
  font-weight: 500;
}

.td-count {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.text-muted {
  color: var(--text-muted);
}

.overdue-count {
  background: rgba(248, 81, 73, 0.2);
  color: var(--danger);
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
}

.waiting-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
}

.waiting-section-title {
  font-size: 0.9375rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
  color: var(--text-secondary);
}

.waiting-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.waiting-row:hover {
  background: var(--bg-tertiary);
}

.waiting-row--overdue {
  background: var(--overdue-bg);
  border: 1px solid var(--overdue-border);
}

.waiting-fan {
  flex: 1;
  font-weight: 500;
}

.waiting-timer {
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
