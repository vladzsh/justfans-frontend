<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { useMessagesStore } from '@/stores/messages'
import { api } from '@/services/api'
import MessageInput from '@/components/MessageInput.vue'
import type { Message, OptimisticMessage } from '@/types/contracts'

const conversationsStore = useConversationsStore()
const messagesStore = useMessagesStore()

const conversationId = computed(() => conversationsStore.activeId!)
const conversation = computed(() => conversationsStore.byId[conversationId.value])
const messages = computed(() => messagesStore.getMessages(conversationId.value))
const canLoadMore = computed(() => messagesStore.hasMore(conversationId.value))

const scrollEl = ref<HTMLElement | null>(null)
const loadingMore = ref(false)

function isMessage(m: Message | OptimisticMessage): m is Message {
  return !('pending' in m)
}

function isFailed(m: Message | OptimisticMessage): m is OptimisticMessage & { failed: true } {
  return 'pending' in m && !!(m as OptimisticMessage).failed
}

function retryFailed(m: OptimisticMessage) {
  messagesStore.retryMessage(m.client_msg_id)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollEl.value) {
      scrollEl.value.scrollTop = scrollEl.value.scrollHeight
    }
  })
}

async function loadOlder() {
  if (loadingMore.value || !canLoadMore.value) return
  loadingMore.value = true

  const el = scrollEl.value
  const prevScrollHeight = el?.scrollHeight ?? 0

  await messagesStore.loadOlderMessages(conversationId.value)

  await nextTick()
  if (el) {
    el.scrollTop = el.scrollHeight - prevScrollHeight
  }
  loadingMore.value = false
}

function handleScroll() {
  if (!scrollEl.value) return
  if (scrollEl.value.scrollTop < 80) {
    loadOlder()
  }
}

async function simulateFanMessage() {
  await api.post('/api/demo/fan-message/', { conversation_id: conversationId.value })
}

watch(
  conversationId,
  () => {
    scrollToBottom()
  },
)

watch(
  () => messages.value.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      const el = scrollEl.value
      if (!el) return
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
      if (atBottom) scrollToBottom()
    }
  },
)

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div v-if="conversation" class="thread">
    <div class="thread-header">
      <div class="thread-header-left">
        <span class="thread-fan-avatar">{{ conversation.fan.avatar }}</span>
        <div class="thread-fan-info">
          <span class="thread-fan-name">{{ conversation.fan.name }}</span>
          <span class="thread-model-name">{{ conversation.model.avatar }} {{ conversation.model.name }}</span>
        </div>
      </div>
      <button class="btn-simulate" @click="simulateFanMessage" title="Симулировать сообщение фана">
        💬 Симулировать сообщение фана
      </button>
    </div>

    <div v-if="messagesStore.globalError" class="error-banner" role="alert">
      <span class="error-banner-text">{{ messagesStore.globalError }}</span>
      <button class="error-banner-dismiss" @click="messagesStore.clearGlobalError()">×</button>
    </div>

    <div class="thread-messages" ref="scrollEl" @scroll="handleScroll">
      <div v-if="canLoadMore" class="load-more-row">
        <button class="btn-load-more" :disabled="loadingMore" @click="loadOlder">
          {{ loadingMore ? 'Загрузка...' : 'Загрузить ещё' }}
        </button>
      </div>

      <div
        v-for="msg in messages"
        :key="isMessage(msg) ? msg.id : msg.client_msg_id"
        class="msg-row"
        :class="msg.sender === 'chatter' ? 'msg-row--chatter' : 'msg-row--fan'"
      >
        <div
          class="msg-bubble"
          :class="{
            'msg-bubble--chatter': msg.sender === 'chatter',
            'msg-bubble--fan': msg.sender === 'fan',
            'msg-bubble--ppv': msg.kind === 'ppv',
            'msg-bubble--pending': !isMessage(msg) && !isFailed(msg),
            'msg-bubble--failed': isFailed(msg),
          }"
          :title="isFailed(msg) ? 'Click to retry' : undefined"
          @click="isFailed(msg) ? retryFailed(msg as OptimisticMessage) : undefined"
        >
          <div v-if="msg.kind === 'ppv'" class="ppv-badge">
            💎 PPV · {{ msg.ppv_price }}$
          </div>
          <p class="msg-text">{{ msg.text }}</p>
          <span v-if="isFailed(msg)" class="msg-error-detail">
            ❌ {{ (msg as OptimisticMessage).error_detail }}
          </span>
          <span class="msg-time">
            {{ formatTime(msg.created_at) }}
            <span v-if="!isMessage(msg) && !isFailed(msg)" class="msg-pending-indicator">⏳</span>
          </span>
        </div>
      </div>
    </div>

    <MessageInput :conversation-id="conversationId" />
  </div>
</template>

<style scoped>
.thread {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.thread-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.thread-fan-avatar {
  font-size: 1.5rem;
}

.thread-fan-info {
  display: flex;
  flex-direction: column;
}

.thread-fan-name {
  font-weight: 500;
  color: var(--text-primary);
}

.thread-model-name {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.btn-simulate {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
  transition: all 0.15s;
}

.btn-simulate:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.thread-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}

.btn-load-more {
  font-size: 0.8125rem;
  color: var(--accent);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0.375rem 1rem;
}

.btn-load-more:hover:not(:disabled) {
  background: var(--bg-hover);
}

.msg-row {
  display: flex;
}

.msg-row--chatter {
  justify-content: flex-end;
}

.msg-row--fan {
  justify-content: flex-start;
}

.msg-bubble {
  max-width: 70%;
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  word-break: break-word;
}

.msg-bubble--chatter {
  background: var(--accent);
  color: #0d1117;
  border-bottom-right-radius: 4px;
}

.msg-bubble--fan {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

.msg-bubble--ppv {
  background: var(--ppv-bg);
  border: 1px solid var(--ppv-border);
  color: var(--text-primary);
}

.msg-bubble--pending {
  opacity: 0.7;
}

.ppv-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 0.25rem;
}

.msg-text {
  font-size: 0.9375rem;
  line-height: 1.4;
}

.msg-time {
  display: block;
  font-size: 0.6875rem;
  opacity: 0.7;
  margin-top: 0.25rem;
  text-align: right;
}

.msg-pending-indicator {
  margin-left: 2px;
}

.msg-bubble--failed {
  background: var(--error-bg, #3a1a1a);
  border: 1px solid var(--error-border, #7f2a2a);
  color: var(--text-primary);
  cursor: pointer;
  opacity: 1;
}

.msg-bubble--failed:hover {
  border-color: var(--error-hover, #c94040);
}

.msg-error-detail {
  display: block;
  font-size: 0.75rem;
  color: var(--error-text, #e57373);
  margin-top: 0.25rem;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--error-bg, #3a1a1a);
  border-bottom: 1px solid var(--error-border, #7f2a2a);
  color: var(--error-text, #e57373);
  font-size: 0.875rem;
  flex-shrink: 0;
}

.error-banner-text {
  flex: 1;
}

.error-banner-dismiss {
  font-size: 1rem;
  line-height: 1;
  color: var(--error-text, #e57373);
  background: none;
  border: none;
  padding: 0 0.25rem;
  cursor: pointer;
  opacity: 0.7;
}

.error-banner-dismiss:hover {
  opacity: 1;
}
</style>
