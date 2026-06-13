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

  it('continuous pongs keep the socket alive', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Each heartbeat tick sends a ping; a pong answers before the next tick
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(HEARTBEAT * 1000)
      inst.simulatePong()
    }

    expect(inst.send).toHaveBeenCalled()
    expect(inst.close).not.toHaveBeenCalled()
  })

  it('missing pong for two heartbeats drops the connection and reconnects without a graceful close', () => {
    connect()
    const inst = MockWebSocket.instances[0]
    inst.simulateOpen()

    // Tick 1: ping sent, now awaiting a pong that never comes
    vi.advanceTimersByTime(HEARTBEAT * 1000)
    expect(inst.send).toHaveBeenCalled()
    expect(inst.close).not.toHaveBeenCalled()

    // Tick 2: still awaiting → connection declared dead
    vi.advanceTimersByTime(HEARTBEAT * 1000)
    expect(inst.close).toHaveBeenCalledTimes(1)

    // Reconnect is scheduled directly — no onclose event from the dead socket is required
    vi.advanceTimersByTime(2_000)
    expect(MockWebSocket.instances.length).toBe(2)
  })
})
