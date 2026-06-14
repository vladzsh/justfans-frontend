<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMonitorStore, calcMonitorKpis } from '@/stores/monitor'
import WsIndicator from '@/components/WsIndicator.vue'
import { now } from '@/composables/useTicker'

const authStore = useAuthStore()
const monitorStore = useMonitorStore()

const overdueLabel = computed(() => {
  const s = authStore.config.overdue_seconds
  const min = Math.floor(s / 60)
  const sec = s % 60
  if (min > 0 && sec > 0) return `${min} мин ${sec} сек`
  if (min > 0) return `${min} мин`
  return `${s} сек`
})

const kpis = computed(() =>
  calcMonitorKpis(
    monitorStore.sortedChatters,
    now.value,
    authStore.config.overdue_seconds,
    authStore.config.presence_grace_seconds,
  ),
)

onMounted(async () => {
  await monitorStore.loadSnapshot()
})

async function handleLogout() {
  await authStore.logout()
}
</script>

<template>
  <div class="monitor-layout">
    <div class="monitor-header">
      <span class="monitor-header-title">Монитор тимлида — JustFans CRM</span>
      <div class="monitor-header-right">
        <span class="overdue-threshold">Порог просрочки: {{ overdueLabel }}</span>
        <WsIndicator />
        <span class="user-info">{{ authStore.user?.display_name }}</span>
        <button class="btn-logout" @click="handleLogout">Выйти</button>
      </div>
    </div>

    <div class="monitor-body">
      <!-- KPI summary bar -->
      <div class="kpi-bar">
        <div class="kpi-chip">
          <span class="kpi-label">Диалогов</span>
          <span class="kpi-value">{{ kpis.totalDialogs }}</span>
        </div>
        <div class="kpi-divider" />
        <div class="kpi-chip">
          <span class="kpi-label">Ждут</span>
          <span class="kpi-value">{{ kpis.totalWaiting }}</span>
        </div>
        <div class="kpi-divider" />
        <div class="kpi-chip">
          <span class="kpi-label">Просрочено</span>
          <span class="kpi-value" :class="{ 'kpi-value--danger': kpis.overdueCount > 0 }">
            {{ kpis.overdueCount }}
          </span>
        </div>
        <div class="kpi-divider" />
        <div class="kpi-chip">
          <span class="kpi-label">Онлайн</span>
          <span class="kpi-value">{{ kpis.onlineCount }}/{{ kpis.totalChatters }}</span>
        </div>
      </div>

      <!-- Tab navigation -->
      <nav class="monitor-tabs">
        <RouterLink class="monitor-tab" :to="{ name: 'monitor-analytics' }">Аналитика</RouterLink>
        <RouterLink class="monitor-tab" :to="{ name: 'monitor-chatters' }">Чатеры</RouterLink>
        <RouterLink class="monitor-tab" :to="{ name: 'monitor-queue' }">Очередь</RouterLink>
      </nav>

      <!-- Active tab -->
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.monitor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.monitor-header-title {
  font-weight: 600;
  color: var(--text-primary);
}

.monitor-header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.btn-logout {
  color: var(--text-secondary);
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: color 0.15s;
}

.btn-logout:hover {
  color: var(--danger);
}

.monitor-body {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.overdue-threshold {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  border: 1px solid var(--border);
}

/* KPI bar */
.kpi-bar {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.kpi-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.625rem 1.25rem;
  gap: 0.125rem;
  flex: 1;
}

.kpi-divider {
  width: 1px;
  align-self: stretch;
  background: var(--border);
  flex-shrink: 0;
}

.kpi-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kpi-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.kpi-value--danger {
  color: var(--danger);
}

/* Tab navigation */
.monitor-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.monitor-tab {
  padding: 0.5rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.monitor-tab:hover {
  color: var(--text-primary);
}

.monitor-tab.router-link-active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
</style>
