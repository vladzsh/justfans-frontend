<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useConversationsStore } from '@/stores/conversations'
import ConversationList from '@/components/ConversationList.vue'
import MessageThread from '@/components/MessageThread.vue'

const authStore = useAuthStore()
const conversationsStore = useConversationsStore()

onMounted(async () => {
  await conversationsStore.load()
})

async function handleLogout() {
  const { logout } = authStore
  await logout()
}
</script>

<template>
  <div class="chat-layout">
    <div class="chat-header">
      <span class="chat-header-title">JustFans CRM</span>
      <div class="chat-header-right">
        <span class="user-info">{{ authStore.user?.display_name }}</span>
        <button class="btn-logout" @click="handleLogout">Выйти</button>
      </div>
    </div>

    <div class="chat-body">
      <ConversationList />
      <div class="chat-main">
        <MessageThread v-if="conversationsStore.activeId !== null" />
        <div v-else class="chat-empty">
          <p>Выберите диалог для начала переписки</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.chat-header-title {
  font-weight: 600;
  color: var(--text-primary);
}

.chat-header-right {
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

.chat-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}
</style>
