<script setup lang="ts">
import { computed } from 'vue'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { now } from '@/composables/useTicker'
import { calcIsOffline, calcIsOverdue } from '@/stores/monitor'
import type { ChatterStatus, WaitingDialog } from '@/types/contracts'

const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const config = computed(() => authStore.config)

function isOffline(chatter: ChatterStatus): boolean {
  return calcIsOffline(
    chatter.connected,
    chatter.last_seen,
    now.value,
    config.value.presence_grace_seconds,
  )
}

function isOverdue(dialog: WaitingDialog): boolean {
  return calcIsOverdue(dialog.waiting_since, now.value, config.value.overdue_seconds)
}

function overdueCount(chatter: ChatterStatus): number {
  return chatter.waiting.filter((d) => isOverdue(d)).length
}

function lastSeen(iso: string | null): string {
  if (iso === null) return '—'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <div class="monitor-wrap">
    <h2 class="monitor-title">Чатеры ({{ monitorStore.sortedChatters.length }})</h2>

    <div v-if="monitorStore.sortedChatters.length === 0" class="monitor-empty">
      Нет данных
    </div>

    <table v-else class="monitor-table">
      <thead>
        <tr>
          <th>Чатер</th>
          <th>Статус</th>
          <th>Последний онлайн</th>
          <th>Диалогов</th>
          <th>Ожидают</th>
          <th>Просрочено</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="chatter in monitorStore.sortedChatters"
          :key="chatter.id"
          :class="{ 'row--offline': isOffline(chatter) }"
        >
          <td class="td-name">{{ chatter.display_name }}</td>
          <td>
            <span
              class="status-badge"
              :class="isOffline(chatter) ? 'status-badge--offline' : 'status-badge--online'"
            >
              {{ isOffline(chatter) ? 'Офлайн' : 'Онлайн' }}
            </span>
          </td>
          <td class="td-lastseen">{{ lastSeen(chatter.last_seen) }}</td>
          <td class="td-count">{{ chatter.dialogs_count }}</td>
          <td class="td-count">
            <span v-if="chatter.waiting.length > 0">{{ chatter.waiting.length }}</span>
            <span v-else class="text-muted">—</span>
          </td>
          <td class="td-count">
            <span v-if="overdueCount(chatter) > 0" class="overdue-count">
              {{ overdueCount(chatter) }}
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

.monitor-table tr.row--offline {
  opacity: 0.6;
}

.td-name {
  font-weight: 500;
}

.td-lastseen {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.td-count {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.text-muted {
  color: var(--text-muted);
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
}

.status-badge--online {
  background: rgba(63, 185, 80, 0.2);
  color: var(--success);
}

.status-badge--offline {
  background: rgba(248, 81, 73, 0.2);
  color: var(--danger);
}

.overdue-count {
  background: rgba(248, 81, 73, 0.2);
  color: var(--danger);
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
}
</style>
