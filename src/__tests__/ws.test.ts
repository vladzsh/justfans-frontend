import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { connect, disconnect, on, off, _resetForTest, setHeartbeatSeconds, wsStatus } from '@/services/ws'

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState: number = MockWebSocket.CONNECTING

  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  send = vi.fn()
  close = vi.fn()

  static instances: MockWebSocket[] = []

  constructor(_url: string) {
    MockWebSocket.instances.push(this)
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }

  simulatePong() {
    this.onmessage?.({
      data: JSON.stringify({ type: 'pong', payload: {} }),
    } as MessageEvent)
  }

  static reset() {
    MockWebSocket.instances = []
  }
}

vi.stubGlobal('WebSocket', MockWebSocket)

// ---------------------------------------------------------------------------
// Window mock with addEventListener / removeEventListener support
// ---------------------------------------------------------------------------

// Mutable registry that stub closures capture by reference so beforeEach
// can wipe it cleanly without replacing the stubbed window object.
const windowListeners: Record<string, Set<() => void>> = {}

function clearWindowListeners() {
  for (const key of Object.keys(windowListeners)) {
    delete windowListeners[key]
  }
}

function simulateWindowEvent(event: string) {
  for (const h of windowListeners[event] ?? []) h()
}

vi.stubGlobal('window', {
  location: { protocol: 'http:', host: 'localhost' },
  addEventListener(event: string, handler: () => void) {
    if (!windowListeners[event]) windowListeners[event] = new Set()
    windowListeners[event].add(handler)
  },
  removeEventListener(event: string, handler: () => void) {
    windowListeners[event]?.delete(handler)
  },
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ws service — isReconnect flag', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.reset()
    clearWindowListeners()
    _resetForTest()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('dispatches isReconnect: false on first connection', () => {
    const handler = vi.fn()
    on('connected', handler)

    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()
    inst.simulatePong() // answer immediate ping so deadline is cleared

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ isReconnect: false })

    off('connected', handler)
  })

  it('dispatches isReconnect: true when reconnecting after a drop', () => {
    const handler = vi.fn()
    on('connected', handler)

    // First connection
    connect()
    MockWebSocket.instances[0].simulateOpen()
    MockWebSocket.instances[0].simulatePong()
    expect(handler).toHaveBeenNthCalledWith(1, { isReconnect: false })

    // Simulate non-intentional network drop
    MockWebSocket.instances[0].simulateClose()

    // Call connect() directly — guard passes because readyState is CLOSED (3 > OPEN 1)
    connect()
    MockWebSocket.instances[1].simulateOpen()
    MockWebSocket.instances[1].simulatePong()

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(2, { isReconnect: true })

    off('connected', handler)
  })
})

describe('ws service — pong-timeout liveness', () => {
  const HEARTBEAT = 5

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.reset()
    clearWindowListeners()
    _resetForTest()
    setHeartbeatSeconds(HEARTBEAT)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    setHeartbeatSeconds(10)
  })

  it('continuous pongs keep the socket alive', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Answer the immediate ping sent on open
    inst.simulatePong()

    // Each heartbeat tick sends a new ping; pong each one before the deadline
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(HEARTBEAT * 1000)
      inst.simulatePong()
    }

    expect(inst.send).toHaveBeenCalled()
    expect(inst.close).not.toHaveBeenCalled()
  })

  it('missing pong triggers dead-connection via pong deadline without waiting a second heartbeat', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Immediate ping is sent on open. Do NOT pong — advance past the short
    // pong deadline (min(heartbeat, 4) = 4 s). Connection should die there,
    // well before the next heartbeat tick at t = 5 s.
    const PONG_DEADLINE = Math.min(HEARTBEAT, 4)
    vi.advanceTimersByTime(PONG_DEADLINE * 1000 + 1)
    expect(inst.close).toHaveBeenCalledTimes(1)

    // Reconnect is scheduled directly — no onclose from the dead socket required
    vi.advanceTimersByTime(2_000)
    expect(MockWebSocket.instances.length).toBe(2)
  })
})

describe('ws service — pong deadline', () => {
  const HEARTBEAT = 5

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.reset()
    clearWindowListeners()
    _resetForTest()
    setHeartbeatSeconds(HEARTBEAT)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    setHeartbeatSeconds(10)
  })

  it('immediate ping is sent on connection open before any heartbeat interval fires', () => {
    connect()
    const inst = MockWebSocket.instances[0]

    // No ping before open
    expect(inst.send).not.toHaveBeenCalled()

    inst.simulateOpen()

    // Ping must be sent immediately — no timer advancement needed
    expect(inst.send).toHaveBeenCalledTimes(1)
    const msg = JSON.parse(inst.send.mock.calls[0][0] as string) as { type: string }
    expect(msg.type).toBe('ping')
  })

  it('pong deadline fires handleDeadConnection after min(heartbeat, 4) seconds of no pong', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Immediate ping sent — do not pong
    const PONG_DEADLINE = Math.min(HEARTBEAT, 4)
    vi.advanceTimersByTime(PONG_DEADLINE * 1000)
    expect(inst.close).toHaveBeenCalledTimes(1)
    expect(wsStatus.value).toBe('disconnected')
  })

  it('pong arriving just before the deadline keeps the connection alive', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    const PONG_DEADLINE = Math.min(HEARTBEAT, 4)

    // Advance to just before the deadline and pong
    vi.advanceTimersByTime(PONG_DEADLINE * 1000 - 100)
    inst.simulatePong()

    // Advance past the deadline window — should NOT close
    vi.advanceTimersByTime(200)
    expect(inst.close).not.toHaveBeenCalled()
  })

  it('pong deadline on subsequent heartbeat ticks works the same way', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Answer the immediate ping
    inst.simulatePong()

    // Let first heartbeat tick fire and send another ping — do not pong this one
    vi.advanceTimersByTime(HEARTBEAT * 1000)
    expect(inst.send).toHaveBeenCalledTimes(2)

    // Advance past deadline for this second ping
    const PONG_DEADLINE = Math.min(HEARTBEAT, 4)
    vi.advanceTimersByTime(PONG_DEADLINE * 1000)
    expect(inst.close).toHaveBeenCalledTimes(1)
  })
})

describe('ws service — network online/offline events', () => {
  const HEARTBEAT = 5

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.reset()
    clearWindowListeners()
    _resetForTest()
    setHeartbeatSeconds(HEARTBEAT)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    setHeartbeatSeconds(10)
  })

  it('online event cancels backoff and reconnects immediately', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()
    inst.simulatePong()

    // Drop the connection — reconnect is now scheduled with backoff
    inst.simulateClose()
    expect(MockWebSocket.instances.length).toBe(1)

    // Simulate network returning before the backoff timer fires
    simulateWindowEvent('online')

    // A new socket must have been created immediately, without advancing timers
    expect(MockWebSocket.instances.length).toBe(2)
  })

  it('online event resets reconnect attempt counter', () => {
    // Connect and close several times to build up backoff
    connect()
    MockWebSocket.instances[0].simulateOpen()
    MockWebSocket.instances[0].simulatePong()
    MockWebSocket.instances[0].simulateClose()

    // Advance just enough for first backoff to fire, then close again
    vi.advanceTimersByTime(2_000)
    MockWebSocket.instances[1].simulateOpen()
    MockWebSocket.instances[1].simulatePong()
    MockWebSocket.instances[1].simulateClose()

    // Online fires → attempt resets → immediate reconnect
    simulateWindowEvent('online')
    // Socket 3 (index 2) is created by the online handler's connect() call
    expect(MockWebSocket.instances.length).toBe(3)
    // Pong so no dangling deadline
    MockWebSocket.instances[2].simulateOpen()
    MockWebSocket.instances[2].simulatePong()
  })

  it('offline event with open socket triggers immediate dead connection detection', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()
    // Pong the immediate ping first
    inst.simulatePong()

    // Simulate going offline
    simulateWindowEvent('offline')

    expect(inst.close).toHaveBeenCalledTimes(1)
    expect(wsStatus.value).toBe('disconnected')
  })

  it('offline event with no open socket does not double-schedule reconnect', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()
    inst.simulatePong()

    // Socket already dead and in backoff
    inst.simulateClose()

    // Offline fires — socket is already CLOSED, should not call close again
    simulateWindowEvent('offline')
    expect(inst.close).not.toHaveBeenCalled()
  })

  it('listeners are removed on disconnect and not fired after intentional close', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()
    inst.simulatePong()

    disconnect()

    // Online fires after intentional disconnect — must not create a new socket
    simulateWindowEvent('online')
    expect(MockWebSocket.instances.length).toBe(1)
  })
})
