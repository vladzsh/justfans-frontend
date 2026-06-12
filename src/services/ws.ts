import { ref } from 'vue'

export type WsStatus = 'disconnected' | 'connecting' | 'connected'
export type EventHandler = (payload: unknown) => void

export const wsStatus = ref<WsStatus>('disconnected')

const handlers: Record<string, EventHandler[]> = {}

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let reconnectAttempt = 0
let heartbeatSeconds = 10
let intentionalClose = false
let hasConnectedBefore = false

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/`
}

function dispatch(type: string, payload: unknown) {
  for (const h of handlers[type] ?? []) {
    h(payload)
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    send({ type: 'ping', payload: {} })
  }, heartbeatSeconds * 1000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function scheduleReconnect() {
  if (intentionalClose) return
  const base = Math.min(30_000, 1_000 * 2 ** reconnectAttempt)
  const jitter = Math.random() * base * 0.5
  const delay = base + jitter
  reconnectAttempt++
  reconnectTimer = setTimeout(connect, delay)
}

export function connect() {
  if (socket && socket.readyState <= WebSocket.OPEN) return
  intentionalClose = false
  wsStatus.value = 'connecting'

  socket = new WebSocket(getWsUrl())

  socket.onopen = () => {
    wsStatus.value = 'connected'
    reconnectAttempt = 0
    startHeartbeat()
    dispatch('connected', { isReconnect: hasConnectedBefore })
    hasConnectedBefore = true
  }

  socket.onmessage = (event) => {
    let envelope: { type: string; payload: unknown }
    try {
      envelope = JSON.parse(event.data as string) as { type: string; payload: unknown }
    } catch {
      return
    }
    dispatch(envelope.type, envelope.payload)
  }

  socket.onclose = () => {
    wsStatus.value = 'disconnected'
    stopHeartbeat()
    scheduleReconnect()
  }

  socket.onerror = () => {
    socket?.close()
  }
}

export function disconnect() {
  intentionalClose = true
  hasConnectedBefore = false
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  stopHeartbeat()
  socket?.close()
  socket = null
  wsStatus.value = 'disconnected'
}

export function send(msg: { type: string; payload: unknown }) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg))
  }
}

export function on(type: string, handler: EventHandler) {
  if (!handlers[type]) handlers[type] = []
  if (!handlers[type].includes(handler)) {
    handlers[type].push(handler)
  }
}

export function off(type: string, handler: EventHandler) {
  if (handlers[type]) {
    handlers[type] = handlers[type].filter((h) => h !== handler)
  }
}

export function setHeartbeatSeconds(seconds: number) {
  heartbeatSeconds = seconds
}

/** Reset all module-level state. Only for use in tests. */
export function _resetForTest() {
  hasConnectedBefore = false
  intentionalClose = false
  reconnectAttempt = 0
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  stopHeartbeat()
  socket = null
}
