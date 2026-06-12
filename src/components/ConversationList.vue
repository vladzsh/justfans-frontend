<script setup lang="ts">
import { useConversationsStore } from '@/stores/conversations'
import { useMessagesStore } from '@/stores/messages'
import ConversationItem from '@/components/ConversationItem.vue'

const conversationsStore = useConversationsStore()
const messagesStore = useMessagesStore()

async function selectConversation(id: number) {
  conversationsStore.setActive(id)
  await messagesStore.loadMessages(id)
  if ((conversationsStore.byId[id]?.unread_count ?? 0) > 0) {
    await conversationsStore.markRead(id)
  }
}
</script>

<template>
  <aside class="conv-list">
    <div class="conv-list-header">
      <span>Диалоги</span>
      <span class="conv-list-count">{{ conversationsStore.sorted.length }}</span>
    </div>
    <div class="conv-list-scroll">
      <ConversationItem
        v-for="conv in conversationsStore.sorted"
        :key="conv.id"
        :conversation="conv"
        :active="conversationsStore.activeId === conv.id"
        @select="selectConversation"
      />
      <div v-if="conversationsStore.sorted.length === 0" class="conv-list-empty">
        Нет диалогов
      </div>
    </div>
  </aside>
</template>

<style scoped>
.conv-list {
  width: 300px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.conv-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.conv-list-count {
  font-size: 0.75rem;
  background: var(--bg-tertiary);
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
  color: var(--text-secondary);
}

.conv-list-scroll {
  flex: 1;
  overflow-y: auto;
}

.conv-list-empty {
  padding: 1rem;
  text-align: center;
  color: var(--text-muted);
}
</style>
