import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { User, AppConfig } from '@/types/contracts'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const config = ref<AppConfig>({ overdue_seconds: 120, presence_grace_seconds: 30, heartbeat_seconds: 10 })
  const initialized = ref(false)
  const loading = ref(false)

  async function init() {
    if (initialized.value) return
    try {
      const [me, cfg] = await Promise.all([
        api.get<User>('/api/auth/me/'),
        api.get<AppConfig>('/api/config/'),
      ])
      user.value = me
      config.value = cfg
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(username: string, password: string) {
    loading.value = true
    try {
      // Sequence calls: we need the session cookie from login to be set before calling /api/config/
      user.value = await api.post<User>('/api/auth/login/', { username, password })
      config.value = await api.get<AppConfig>('/api/config/')
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await api.post('/api/auth/logout/')
    user.value = null
  }

  return { user, config, initialized, loading, init, login, logout }
})
