<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMonitorStore } from '@/stores/monitor'
import MonitorTable from '@/components/MonitorTable.vue'
import ModelsTable from '@/components/ModelsTable.vue'
import WsIndicator from '@/components/WsIndicator.vue'

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
      <MonitorTable />
      <ModelsTable />
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
</style>
