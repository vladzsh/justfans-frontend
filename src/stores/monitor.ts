import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { now } from '@/composables/useTicker'
import type { ChatterStatus, ModelStatus, MonitorSnapshot } from '@/types/contracts'

export function calcIsOffline(
  connected: boolean,
  lastSeen: string | null,
  nowMs: number,
  graceSeconds: number,
): boolean {
  // Fast path: a clean disconnect reports connected=false → offline immediately.
  if (!connected) return true
  // Silent drop: connected stays true but heartbeats stopped → last_seen goes stale.
  if (!lastSeen) return true
  const lastSeenMs = new Date(lastSeen).getTime()
  if (isNaN(lastSeenMs)) return true
  return nowMs - lastSeenMs > graceSeconds * 1000
}

export function calcIsOverdue(waitingSince: string, nowMs: number, overdueSeconds: number): boolean {
  const sinceMs = new Date(waitingSince).getTime()
  if (isNaN(sinceMs)) return false
  return nowMs - sinceMs > overdueSeconds * 1000
}

/** Format elapsed time since an ISO timestamp into a human-readable Russian duration.
 *  ≥1d → "Nд MMч" | ≥1h → "Nч MMм" | ≥1min → "Nм SSс" | <1min → "Sс"
 *  Invalid date or negative diff → "—"
 */
export function formatWaitDuration(sinceIso: string, nowMs: number): string {
  const sinceMs = new Date(sinceIso).getTime()
  if (isNaN(sinceMs)) return '—'
  const totalSec = Math.max(0, Math.floor((nowMs - sinceMs) / 1000))

  if (totalSec < 60) {
    return `${totalSec}с`
  }
  if (totalSec < 3600) {
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}м ${String(sec).padStart(2, '0')}с`
  }
  if (totalSec < 86400) {
    const hours = Math.floor(totalSec / 3600)
    const remMin = Math.floor((totalSec % 3600) / 60)
    return `${hours}ч ${String(remMin).padStart(2, '0')}м`
  }
  const days = Math.floor(totalSec / 86400)
  const remHours = Math.floor((totalSec % 86400) / 3600)
  return `${days}д ${String(remHours).padStart(2, '0')}ч`
}

export interface QueueRow {
  conversation_id: number
  fan_name: string
  /** ISO timestamp when the fan started waiting, or null when the chatter has replied. */
  waiting_since: string | null
  chatter_name: string
  model_name: string
  model_avatar: string
  status: 'overdue' | 'unanswered' | 'ok'
}

const STATUS_ORDER: Record<QueueRow['status'], number> = { overdue: 0, unanswered: 1, ok: 2 }

/** Build the full per-chatter dialog queue from the embedded dialogs[] field.
 *  Derives a 3-way status from awaiting_reply_since + overdueSeconds.
 *  Sort: overdue → unanswered → ok; within overdue/unanswered oldest-first;
 *  within ok alphabetically by fan_name. */
export function buildOverdueQueue(
  chatters: ChatterStatus[],
  nowMs: number,
  overdueSeconds: number,
): QueueRow[] {
  const rows: QueueRow[] = []
  for (const chatter of chatters) {
    for (const dialog of chatter.dialogs) {
      let status: QueueRow['status']
      if (dialog.awaiting_reply_since == null) {
        status = 'ok'
      } else if (calcIsOverdue(dialog.awaiting_reply_since, nowMs, overdueSeconds)) {
        status = 'overdue'
      } else {
        status = 'unanswered'
      }
      rows.push({
        conversation_id: dialog.conversation_id,
        fan_name: dialog.fan_name,
        waiting_since: dialog.awaiting_reply_since,
        chatter_name: chatter.display_name,
        model_name: dialog.model_name,
        model_avatar: dialog.model_avatar,
        status,
      })
    }
  }

  rows.sort((a, b) => {
    const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (diff !== 0) return diff
    if (a.status === 'ok') return a.fan_name.localeCompare(b.fan_name)
    return new Date(a.waiting_since!).getTime() - new Date(b.waiting_since!).getTime()
  })
  return rows
}

export interface MonitorKpis {
  totalDialogs: number
  totalWaiting: number
  overdueCount: number
  onlineCount: number
  totalChatters: number
}

/** Aggregate KPI counters from all chatters for the summary bar. */
export function calcMonitorKpis(
  chatters: ChatterStatus[],
  nowMs: number,
  overdueSeconds: number,
  graceSeconds: number,
): MonitorKpis {
  let totalDialogs = 0
  let totalWaiting = 0
  let overdueCount = 0
  let onlineCount = 0

  for (const chatter of chatters) {
    totalDialogs += chatter.dialogs_count
    totalWaiting += chatter.waiting.length
    for (const dialog of chatter.waiting) {
      if (calcIsOverdue(dialog.waiting_since, nowMs, overdueSeconds)) {
        overdueCount++
      }
    }
    if (!calcIsOffline(chatter.connected, chatter.last_seen, nowMs, graceSeconds)) {
      onlineCount++
    }
  }

  return { totalDialogs, totalWaiting, overdueCount, onlineCount, totalChatters: chatters.length }
}

export const useMonitorStore = defineStore('monitor', () => {
  const chatters = ref<Record<number, ChatterStatus>>({})
  const models = ref<Record<number, ModelStatus>>({})

  const sortedChatters = computed<ChatterStatus[]>(() =>
    Object.values(chatters.value).sort((a, b) => a.display_name.localeCompare(b.display_name)),
  )

  const sortedModels = computed<ModelStatus[]>(() =>
    Object.values(models.value).sort((a, b) => a.name.localeCompare(b.name)),
  )

  async function loadSnapshot() {
    const snap = await api.get<MonitorSnapshot>('/api/monitor/snapshot/')
    chatters.value = {}
    for (const c of snap.chatters) {
      chatters.value[c.id] = c
    }
    models.value = {}
    for (const m of snap.models) {
      models.value[m.id] = m
    }
  }

  function applyUpdate(chatterData: ChatterStatus) {
    chatters.value[chatterData.id] = chatterData
  }

  function applyModelsUpdate(modelsData: ModelStatus[]) {
    models.value = {}
    for (const m of modelsData) {
      models.value[m.id] = m
    }
  }

  function applyPresenceUpdate(chatterId: number, lastSeen: string | null) {
    const chatter = chatters.value[chatterId]
    if (!chatter) return
    chatters.value[chatterId] = { ...chatter, last_seen: lastSeen }
  }

  function isOffline(chatter: ChatterStatus, graceSeconds: number): boolean {
    return calcIsOffline(chatter.connected, chatter.last_seen, now.value, graceSeconds)
  }

  function isOverdue(waitingSince: string, overdueSeconds: number): boolean {
    return calcIsOverdue(waitingSince, now.value, overdueSeconds)
  }

  return { chatters, models, sortedChatters, sortedModels, loadSnapshot, applyUpdate, applyModelsUpdate, applyPresenceUpdate, isOffline, isOverdue }
})
