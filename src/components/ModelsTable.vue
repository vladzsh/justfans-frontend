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
</style>
