import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { connect, on, off, _resetForTest, setHeartbeatSeconds } from '@/services/ws'

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
// Provide window.location so getWsUrl() works in the node test environment
vi.stubGlobal('window', { location: { protocol: 'http:', host: 'localhost' } })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ws service — isReconnect flag', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.reset()
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
    MockWebSocket.instances[0].simulateOpen()

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
    expect(handler).toHaveBeenNthCalledWith(1, { isReconnect: false })

    // Simulate non-intentional network drop
    MockWebSocket.instances[0].simulateClose()

    // Call connect() directly — guard passes because readyState is CLOSED (3 > OPEN 1)
    connect()
    MockWebSocket.instances[1].simulateOpen()

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
    _resetForTest()
    setHeartbeatSeconds(HEARTBEAT)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    setHeartbeatSeconds(10)
  })

  it('pong arrives within timeout window → socket is NOT closed', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Fire the heartbeat interval → ping is sent and pong timer is armed
    vi.advanceTimersByTime(HEARTBEAT * 1000)
    expect(inst.send).toHaveBeenCalled()

    // Pong arrives before the timeout window expires
    inst.simulatePong()

    // Advance past the pong timeout — timer was already cleared by pong
    vi.advanceTimersByTime(2 * HEARTBEAT * 1000)

    expect(inst.close).not.toHaveBeenCalled()
  })

  it('pong absent for 2×heartbeat → socket.close() is called and reconnect starts', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Fire first heartbeat at t=HEARTBEAT → ping sent, pong timer armed for 2×HEARTBEAT
    vi.advanceTimersByTime(HEARTBEAT * 1000)
    expect(inst.send).toHaveBeenCalled()

    // Advance past pong timeout window (2×HEARTBEAT after it was armed, plus 1ms)
    // Pong timer fires at t = HEARTBEAT + 2×HEARTBEAT = 3×HEARTBEAT
    vi.advanceTimersByTime(2 * HEARTBEAT * 1000 + 1)

    // Pong timeout fires: socket.close() is called
    expect(inst.close).toHaveBeenCalledTimes(1)

    // Simulate the close event so the reconnect path runs
    inst.simulateClose()

    // Reconnect is scheduled: advance past backoff (first attempt = 1s + up to 0.5s jitter)
    vi.advanceTimersByTime(2_000)
    expect(MockWebSocket.instances.length).toBe(2)
  })
})
