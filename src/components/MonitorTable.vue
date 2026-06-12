<script setup lang="ts">
import { computed } from 'vue'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import type { ChatterStatus } from '@/types/contracts'

const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const config = computed(() => authStore.config)

function isOffline(chatter: ChatterStatus): boolean {
  return monitorStore.isOffline(chatter, config.value.presence_grace_seconds)
}

function waitingDuration(since: string): string {
  const diffMs = Date.now() - new Date(since).getTime()
  const totalSec = Math.floor(diffMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

function lastSeen(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
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
        </tr>
      </tbody>
    </table>

    <div
      v-for="chatter in monitorStore.sortedChatters.filter((c) => c.waiting.length > 0)"
      :key="`waiting-${chatter.id}`"
      class="waiting-section"
    >
      <h3 class="waiting-section-title">{{ chatter.display_name }} — ожидают ответа</h3>
      <div
        v-for="dialog in chatter.waiting"
        :key="dialog.conversation_id"
        class="waiting-row"
      >
        <span class="waiting-fan">{{ dialog.fan_name }}</span>
        <span class="waiting-timer">{{ waitingDuration(dialog.waiting_since) }}</span>
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
}

.waiting-row:hover {
  background: var(--bg-tertiary);
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
</style>
