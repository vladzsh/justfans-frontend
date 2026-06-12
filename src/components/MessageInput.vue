<script setup lang="ts">
import { ref } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { send } from '@/services/ws'
import type { OptimisticMessage } from '@/types/contracts'

const props = defineProps<{
  conversationId: number
}>()

const messagesStore = useMessagesStore()

const text = ref('')
const isPpv = ref(false)
const ppvPrice = ref('')
const sending = ref(false)

function validate(): string | null {
  if (!text.value.trim()) return 'Введите текст сообщения'
  if (isPpv.value) {
    const price = parseFloat(ppvPrice.value)
    if (isNaN(price) || price <= 0) return 'Укажите корректную цену PPV'
  }
  return null
}

function sendMessage() {
  const err = validate()
  if (err) return

  const clientMsgId = crypto.randomUUID()
  const optimistic: OptimisticMessage = {
    client_msg_id: clientMsgId,
    conversation_id: props.conversationId,
    sender: 'chatter',
    kind: isPpv.value ? 'ppv' : 'text',
    text: text.value.trim(),
    ppv_price: isPpv.value ? ppvPrice.value : null,
    created_at: new Date().toISOString(),
    pending: true,
  }

  messagesStore.addOptimistic(optimistic)

  const payload: Record<string, unknown> = {
    conversation_id: props.conversationId,
    text: text.value.trim(),
    kind: optimistic.kind,
    client_msg_id: clientMsgId,
  }
  if (isPpv.value) {
    payload.ppv_price = parseFloat(ppvPrice.value)
  }

  send({ type: 'message.send', payload })

  text.value = ''
  if (isPpv.value) {
    ppvPrice.value = ''
    isPpv.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <div class="input-area">
    <div v-if="isPpv" class="ppv-row">
      <label class="ppv-label">💎 Цена PPV ($)</label>
      <input
        v-model="ppvPrice"
        type="number"
        class="ppv-input"
        placeholder="9.99"
        min="0.01"
        step="0.01"
      />
    </div>

    <div class="input-row">
      <button
        class="btn-ppv-toggle"
        :class="{ 'btn-ppv-toggle--active': isPpv }"
        type="button"
        title="PPV-сообщение"
        @click="isPpv = !isPpv"
      >
        💎
      </button>
      <textarea
        v-model="text"
        class="msg-input"
        placeholder="Напишите сообщение..."
        rows="1"
        @keydown="handleKeydown"
      />
      <button
        class="btn-send"
        type="button"
        :disabled="sending"
        @click="sendMessage"
      >
        →
      </button>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.ppv-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.ppv-label {
  font-size: 0.8125rem;
  color: var(--accent);
  font-weight: 500;
}

.ppv-input {
  background: var(--bg-tertiary);
  border: 1px solid var(--ppv-border);
  border-radius: 6px;
  padding: 0.375rem 0.5rem;
  width: 100px;
  color: var(--text-primary);
  outline: none;
}

.ppv-input:focus {
  border-color: var(--accent);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.btn-ppv-toggle {
  font-size: 1.25rem;
  padding: 0.375rem;
  border-radius: 6px;
  border: 1px solid transparent;
  flex-shrink: 0;
  transition: all 0.15s;
}

.btn-ppv-toggle:hover {
  background: var(--bg-tertiary);
}

.btn-ppv-toggle--active {
  background: var(--ppv-bg);
  border-color: var(--ppv-border);
}

.msg-input {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  color: var(--text-primary);
  outline: none;
  resize: none;
  min-height: 38px;
  max-height: 120px;
  overflow-y: auto;
  transition: border-color 0.15s;
}

.msg-input:focus {
  border-color: var(--accent);
}

.btn-send {
  background: var(--accent);
  color: #0d1117;
  font-size: 1.125rem;
  font-weight: 700;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.btn-send:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
