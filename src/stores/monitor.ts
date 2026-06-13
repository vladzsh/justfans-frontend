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
