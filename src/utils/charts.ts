/**
 * Pure data-shaping helpers that transform monitor store data into Chart.js dataset objects.
 * These are framework-free: they take plain inputs and return plain objects — no Vue, no store.
 * Import `Chart.register(...)` only in the consuming component, not here.
 */
import type { ChartData } from 'chart.js'
import type { ChatterStatus, ModelStatus } from '@/types/contracts'
import { calcIsOffline, calcIsOverdue } from '@/stores/monitor'

// ─── Palette (mirrors :root CSS custom properties in global.css) ──────────────
export const CHART_COLORS = {
  accent: '#58a6ff',    // online chatters, dialogs
  danger: '#f85149',    // overdue, offline
  warning: '#e3b341',   // waiting (non-overdue)
  success: '#3fb950',   // online doughnut slice
  muted: '#6e7681',     // grid lines, tick labels
  border: '#30363d',    // dataset borders
  bgSecondary: '#161b22',
} as const

// ─── Chart data builders ──────────────────────────────────────────────────────

/**
 * Bar chart: dialogs_count per chatter.
 * labels = display_name, values = dialogs_count.
 */
export function buildChatterLoadChart(chatters: ChatterStatus[]): ChartData<'bar'> {
  return {
    labels: chatters.map((c) => c.display_name),
    datasets: [
      {
        label: 'Диалогов',
        data: chatters.map((c) => c.dialogs_count),
        backgroundColor: `${CHART_COLORS.accent}99`,
        borderColor: CHART_COLORS.accent,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
}

/**
 * Grouped bar chart: "waiting" and "overdue" counts per chatter.
 * Overdue is a *subset* of waiting — grouped (side-by-side) avoids double-counting.
 */
export function buildWaitingByChatterChart(
  chatters: ChatterStatus[],
  nowMs: number,
  overdueSeconds: number,
): ChartData<'bar'> {
  const waitingCounts = chatters.map((c) => c.waiting.length)
  const overdueCounts = chatters.map((c) =>
    c.waiting.filter((d) => calcIsOverdue(d.waiting_since, nowMs, overdueSeconds)).length,
  )
  return {
    labels: chatters.map((c) => c.display_name),
    datasets: [
      {
        label: 'Ждут',
        data: waitingCounts,
        backgroundColor: `${CHART_COLORS.warning}99`,
        borderColor: CHART_COLORS.warning,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Просрочено',
        data: overdueCounts,
        backgroundColor: `${CHART_COLORS.danger}99`,
        borderColor: CHART_COLORS.danger,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
}

/**
 * Doughnut chart: online vs offline chatter counts.
 */
export function buildOnlineDoughnut(
  chatters: ChatterStatus[],
  nowMs: number,
  graceSeconds: number,
): ChartData<'doughnut'> {
  let onlineCount = 0
  let offlineCount = 0
  for (const c of chatters) {
    if (calcIsOffline(c.connected, c.last_seen, nowMs, graceSeconds)) {
      offlineCount++
    } else {
      onlineCount++
    }
  }
  return {
    labels: ['Онлайн', 'Офлайн'],
    datasets: [
      {
        data: [onlineCount, offlineCount],
        backgroundColor: [`${CHART_COLORS.success}cc`, `${CHART_COLORS.danger}99`],
        borderColor: [`${CHART_COLORS.success}`, `${CHART_COLORS.danger}`],
        borderWidth: 1,
      },
    ],
  }
}

/**
 * Bar chart: dialogs_count per model.
 * labels = "${avatar} ${name}" for visual identity.
 */
export function buildModelLoadChart(models: ModelStatus[]): ChartData<'bar'> {
  return {
    labels: models.map((m) => `${m.avatar} ${m.name}`),
    datasets: [
      {
        label: 'Диалогов',
        data: models.map((m) => m.dialogs_count),
        backgroundColor: `${CHART_COLORS.accent}66`,
        borderColor: CHART_COLORS.accent,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
}
