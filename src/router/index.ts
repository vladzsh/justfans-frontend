import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '@/views/LoginView.vue'
import ChatView from '@/views/ChatView.vue'
import MonitorView from '@/views/MonitorView.vue'
import OverdueQueue from '@/components/OverdueQueue.vue'
import MonitorCharts from '@/components/MonitorCharts.vue'
import MonitorTable from '@/components/MonitorTable.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/chat',
      name: 'chat',
      component: ChatView,
      meta: { requiresAuth: true, role: 'chatter' },
    },
    {
      path: '/monitor',
      component: MonitorView,
      meta: { requiresAuth: true, role: 'teamlead' },
      children: [
        { path: '', redirect: { name: 'monitor-queue' } },
        { path: 'queue', name: 'monitor-queue', component: OverdueQueue },
        { path: 'analytics', name: 'monitor-analytics', component: MonitorCharts },
        { path: 'chatters', name: 'monitor-chatters', component: MonitorTable },
      ],
    },
    {
      path: '/',
      redirect: () => {
        const auth = useAuthStore()
        if (auth.user?.role === 'chatter') return '/chat'
        if (auth.user?.role === 'teamlead') return '/monitor'
        return '/login'
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

let authInitialized = false

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authInitialized) {
    await authStore.init()
    authInitialized = true
  }

  const requiresAuth = to.meta.requiresAuth as boolean | undefined
  const requiredRole = to.meta.role as string | undefined

  if (requiresAuth && !authStore.user) {
    return '/login'
  }

  if (requiredRole && authStore.user?.role !== requiredRole) {
    return authStore.user?.role === 'chatter' ? '/chat' : '/monitor'
  }

  if (to.path === '/login' && authStore.user) {
    return authStore.user.role === 'chatter' ? '/chat' : '/monitor'
  }
})

export default router
