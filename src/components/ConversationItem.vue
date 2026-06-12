<script setup lang="ts">
import type { Conversation } from '@/types/contracts'

const props = defineProps<{
  conversation: Conversation
  active: boolean
}>()

defineEmits<{
  select: [id: number]
}>()

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function preview(c: Conversation): string {
  if (!c.last_message) return ''
  const prefix = c.last_message.sender === 'chatter' ? 'Вы: ' : ''
  return prefix + c.last_message.text
}
</script>

<template>
  <div
    class="conv-item"
    :class="{ 'conv-item--active': active, 'conv-item--waiting': conversation.awaiting_reply_since }"
    @click="$emit('select', conversation.id)"
  >
    <div class="conv-avatar">{{ conversation.fan.avatar }}</div>
    <div class="conv-body">
      <div class="conv-top">
        <span class="conv-name">{{ conversation.fan.name }}</span>
        <span class="conv-time">{{ formatTime(conversation.last_message_at) }}</span>
      </div>
      <div class="conv-bottom">
        <span class="conv-preview">{{ preview(conversation) }}</span>
        <span v-if="conversation.unread_count > 0" class="conv-badge">
          {{ conversation.unread_count }}
        </span>
      </div>
      <div class="conv-meta">
        <span class="conv-model">{{ conversation.model.avatar }} {{ conversation.model.name }}</span>
        <span v-if="conversation.awaiting_reply_since" class="conv-waiting-dot" title="Ждёт ответа" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.conv-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--border);
}

.conv-item:hover {
  background: var(--bg-hover);
}

.conv-item--active {
  background: var(--bg-tertiary);
}

.conv-item--waiting {
  border-left: 3px solid var(--warning);
}

.conv-avatar {
  font-size: 1.5rem;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conv-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.conv-top,
.conv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.conv-name {
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.conv-preview {
  color: var(--text-secondary);
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-badge {
  background: var(--unread-badge);
  color: #0d1117;
  font-size: 0.6875rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  flex-shrink: 0;
}

.conv-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.conv-model {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.conv-waiting-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning);
}
</style>
