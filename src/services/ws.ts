import { ref } from 'vue'

export type WsStatus = 'disconnected' | 'connecting' | 'connected'
export type EventHandler = (payload: unknown) => void

export const wsStatus = ref<WsStatus>('disconnected')

const handlers: Record<string, EventHandler[]> = {}

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let pongDeadlineTimer: ReturnType<typeof setTimeout> | null = null
let awaitingPong = false
let reconnectAttempt = 0
let heartbeatSeconds = 10
let intentionalClose = false
let hasConnectedBefore = false

// Network event handlers — added once per session, removed on disconnect/reset
let onlineHandler: (() => void) | null = null
let offlineHandler: (() => void) | null = null

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/`
}

function dispatch(type: string, payload: unknown) {
  for (const h of handlers[type] ?? []) {
    h(payload)
  }
}

function clearPongDeadline() {
  if (pongDeadlineTimer) {
    clearTimeout(pongDeadlineTimer)
    pongDeadlineTimer = null
  }
}

/**
 * Send a ping and arm a short deadline.  If a pong does not arrive within
 * min(heartbeatSeconds, 4) seconds the connection is declared dead without
 * waiting for the next heartbeat tick, cutting detection latency roughly in
 * half compared to the old 2×heartbeat approach.
 */
function sendPing() {
  awaitingPong = true
  send({ type: 'ping', payload: {} })
  clearPongDeadline()
  pongDeadlineTimer = setTimeout(() => {
    if (awaitingPong) {
      handleDeadConnection()
    }
  }, Math.min(heartbeatSeconds, 4) * 1000)
}

function startHeartbeat() {
  stopHeartbeat()
  awaitingPong = false
  // Send an immediate ping so the server refreshes last_seen right away
  // and the pong deadline starts from the moment the socket opens.
  sendPing()
  heartbeatTimer = setInterval(() => {
    if (awaitingPong) {
      // The pong deadline should catch this first; guard defensively.
      handleDeadConnection()
      return
    }
    sendPing()
  }, heartbeatSeconds * 1000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  clearPongDeadline()
  awaitingPong = false
}

function handleDeadConnection() {
  if (socket) {
    // Detach handlers so a late graceful onclose can't double-trigger reconnect
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
    try {
      socket.close()
    } catch {
      // ignore — the socket is already unusable
    }
    socket = null
  }
  wsStatus.value = 'disconnected'
  stopHeartbeat()
  scheduleReconnect()
}

function scheduleReconnect() {
  if (intentionalClose) return
  const base = Math.min(30_000, 1_000 * 2 ** reconnectAttempt)
  const jitter = Math.random() * base * 0.5
  const delay = base + jitter
  reconnectAttempt++
  reconnectTimer = setTimeout(connect, delay)
}

function addNetworkListeners() {
  if (onlineHandler) return // already registered — only one set per session
  onlineHandler = () => {
    if (intentionalClose) return
    // Cancel any pending backoff and reconnect immediately on network return.
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectAttempt = 0
    connect()
  }
  offlineHandler = () => {
    if (intentionalClose) return
    // Fast hint: declare the connection dead when the browser reports offline.
    // The pong deadline remains the authoritative liveness signal for silent
    // drops; this listener is an optimistic shortcut for the DevTools-offline
    // case where the browser fires the event reliably.
    if (socket && socket.readyState <= WebSocket.OPEN) {
      handleDeadConnection()
    }
  }
  window.addEventListener('online', onlineHandler)
  window.addEventListener('offline', offlineHandler)
}

function removeNetworkListeners() {
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler)
    onlineHandler = null
  }
  if (offlineHandler) {
    window.removeEventListener('offline', offlineHandler)
    offlineHandler = null
  }
}

export function connect() {
  if (socket && socket.readyState <= WebSocket.OPEN) return
  intentionalClose = false
  wsStatus.value = 'connecting'
  addNetworkListeners()

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
    if (envelope.type === 'pong') {
      awaitingPong = false
      clearPongDeadline()
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
  removeNetworkListeners()
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
  removeNetworkListeners()
  socket = null
}
