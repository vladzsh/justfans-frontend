export interface User {
  id: number
  username: string
  display_name: string
  role: 'chatter' | 'teamlead'
}

export interface AppConfig {
  overdue_seconds: number
  presence_grace_seconds: number
  heartbeat_seconds: number
}

export interface Fan {
  id: number
  name: string
  avatar: string
}

export interface ContentModel {
  id: number
  name: string
  avatar: string
}

export interface LastMessage {
  text: string
  sender: 'fan' | 'chatter'
  created_at: string
}

export interface Conversation {
  id: number
  fan: Fan
  model: ContentModel
  last_message: LastMessage | null
  last_message_at: string | null
  unread_count: number
  awaiting_reply_since: string | null
}

export interface Message {
  id: number
  conversation_id: number
  sender: 'fan' | 'chatter'
  kind: 'text' | 'ppv'
  text: string
  ppv_price: string | null
  client_msg_id: string | null
  created_at: string
}

export interface OptimisticMessage {
  client_msg_id: string
  conversation_id: number
  sender: 'chatter'
  kind: 'text' | 'ppv'
  text: string
  ppv_price: string | null
  created_at: string
  pending: true
  /** Set by the server `error` event when the message was rejected. */
  failed?: true
  /** Human-readable rejection detail from the server. */
  error_detail?: string
}

export interface WaitingDialog {
  conversation_id: number
  fan_name: string
  waiting_since: string
}

export interface ChatterStatus {
  id: number
  display_name: string
  connected: boolean
  last_seen: string | null
  dialogs_count: number
  waiting: WaitingDialog[]
}

export interface ModelStatus {
  id: number
  name: string
  avatar: string
  dialogs_count: number
  waiting: WaitingDialog[]
}

export interface MonitorSnapshot {
  chatters: ChatterStatus[]
  models: ModelStatus[]
}

export interface MonitorUpdatePayload {
  chatter: ChatterStatus
  models: ModelStatus[]
}

// WebSocket envelope
export interface WsEnvelope<T = unknown> {
  type: string
  payload: T
}

// WS server→client events
export interface PresenceUpdatePayload {
  chatter_id: number
  last_seen: string | null
}

export interface MessageNewPayload {
  message: Message
  conversation: Conversation
}

export interface ConversationReadPayload {
  conversation_id: number
}

export interface WsErrorPayload {
  code: string
  detail: string
  /** Present when the error is tied to a specific outbound message. */
  client_msg_id?: string
}

// WS client→server events
export interface MessageSendPayload {
  conversation_id: number
  text: string
  kind: 'text' | 'ppv'
  ppv_price?: number
  client_msg_id: string
}

// Sync response
export interface SyncResponse {
  messages: Message[]
  conversations: Conversation[]
}

// Messages page response
export interface MessagesPageResponse {
  results: Message[]
  has_more: boolean
}

// Read response
export interface ReadResponse {
  conversation_id: number
  unread_count: number
}
