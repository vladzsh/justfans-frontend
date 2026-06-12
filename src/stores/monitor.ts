import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { now } from '@/composables/useTicker'
import type { ChatterStatus, MonitorSnapshot } from '@/types/contracts'

export function calcIsOffline(
  connected: boolean,
  lastSeen: string,
  nowMs: number,
  graceSeconds: number,
): boolean {
  if (connected) return false
  return nowMs - new Date(lastSeen).getTime() > graceSeconds * 1000
}

export function calcIsOverdue(waitingSince: string, nowMs: number, overdueSeconds: number): boolean {
  return nowMs - new Date(waitingSince).getTime() > overdueSeconds * 1000
}

export const useMonitorStore = defineStore('monitor', () => {
  const chatters = ref<Record<number, ChatterStatus>>({})

  const sortedChatters = computed<ChatterStatus[]>(() =>
    Object.values(chatters.value).sort((a, b) => a.display_name.localeCompare(b.display_name)),
  )

  async function loadSnapshot() {
    const snap = await api.get<MonitorSnapshot>('/api/monitor/snapshot/')
    chatters.value = {}
    for (const c of snap.chatters) {
      chatters.value[c.id] = c
    }
  }

  function applyUpdate(chatterData: ChatterStatus) {
    chatters.value[chatterData.id] = chatterData
  }

  function isOffline(chatter: ChatterStatus, graceSeconds: number): boolean {
    return calcIsOffline(chatter.connected, chatter.last_seen, now.value, graceSeconds)
  }

  function isOverdue(waitingSince: string, overdueSeconds: number): boolean {
    return calcIsOverdue(waitingSince, now.value, overdueSeconds)
  }

  return { chatters, sortedChatters, loadSnapshot, applyUpdate, isOffline, isOverdue }
})
