<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
  BarController,
  DoughnutController,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { now } from '@/composables/useTicker'
import {
  buildChatterLoadChart,
  buildWaitingByChatterChart,
  buildOnlineDoughnut,
  buildModelLoadChart,
  CHART_COLORS,
} from '@/utils/charts'

// Register only the Chart.js primitives we actually use (tree-shaking)
Chart.register(
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
  BarController,
  DoughnutController,
)

const monitorStore = useMonitorStore()
const authStore = useAuthStore()

// ─── Shared chart options ─────────────────────────────────────────────────────

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: {
      labels: {
        color: CHART_COLORS.muted,
        font: { size: 11 },
      },
    },
    tooltip: {
      backgroundColor: '#21262d',
      titleColor: '#e6edf3',
      bodyColor: '#8b949e',
      borderColor: '#30363d',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: { color: CHART_COLORS.muted, font: { size: 11 } },
      grid: { color: CHART_COLORS.border },
    },
    y: {
      ticks: { color: CHART_COLORS.muted, font: { size: 11 }, precision: 0 },
      grid: { color: CHART_COLORS.border },
      beginAtZero: true,
    },
  },
}

const doughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: CHART_COLORS.muted,
        font: { size: 11 },
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: '#21262d',
      titleColor: '#e6edf3',
      bodyColor: '#8b949e',
      borderColor: '#30363d',
      borderWidth: 1,
    },
  },
}

// ─── Reactive chart data (re-computed on every ticker tick) ──────────────────

const chatterLoadData = computed(() =>
  buildChatterLoadChart(monitorStore.sortedChatters),
)

const waitingData = computed(() =>
  buildWaitingByChatterChart(
    monitorStore.sortedChatters,
    now.value,
    authStore.config.overdue_seconds,
  ),
)

const onlineDoughnutData = computed(() =>
  buildOnlineDoughnut(
    monitorStore.sortedChatters,
    now.value,
    authStore.config.presence_grace_seconds,
  ),
)

const modelLoadData = computed(() =>
  buildModelLoadChart(monitorStore.sortedModels),
)

const hasChatters = computed(() => monitorStore.sortedChatters.length > 0)
const hasModels = computed(() => monitorStore.sortedModels.length > 0)
</script>

<template>
  <div class="charts-section">
    <h2 class="charts-title">Аналитика</h2>

    <div class="charts-grid">
      <!-- Chatter load: dialogs count -->
      <div class="chart-card">
        <div class="chart-card-title">Нагрузка чатеров (диалоги)</div>
        <div v-if="!hasChatters" class="chart-empty">нет данных</div>
        <div v-else class="chart-canvas-wrap">
          <Bar :data="chatterLoadData" :options="barOptions" />
        </div>
      </div>

      <!-- Online / Offline doughnut -->
      <div class="chart-card">
        <div class="chart-card-title">Онлайн / Офлайн</div>
        <div v-if="!hasChatters" class="chart-empty">нет данных</div>
        <div v-else class="chart-canvas-wrap">
          <Doughnut :data="onlineDoughnutData" :options="doughnutOptions" />
        </div>
      </div>

      <!-- Waiting + overdue per chatter -->
      <div class="chart-card">
        <div class="chart-card-title">Ожидание и просрочка (чатеры)</div>
        <div v-if="!hasChatters" class="chart-empty">нет данных</div>
        <div v-else class="chart-canvas-wrap">
          <Bar :data="waitingData" :options="barOptions" />
        </div>
      </div>

      <!-- Model load: dialogs count -->
      <div class="chart-card">
        <div class="chart-card-title">Нагрузка по моделям (диалоги)</div>
        <div v-if="!hasModels" class="chart-empty">нет данных</div>
        <div v-else class="chart-canvas-wrap">
          <Bar :data="modelLoadData" :options="barOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.charts-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.charts-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chart-card-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.chart-canvas-wrap {
  height: 220px;
  position: relative;
}

.chart-empty {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
