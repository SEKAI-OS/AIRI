import { ref, watch } from 'vue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeMessage {
  type: 'text' | 'expression' | 'emotion' | 'status'
  [key: string]: unknown
}

export interface BridgeTextMessage extends BridgeMessage {
  type: 'text'
  content: string
  streaming?: boolean
}

export interface BridgeExpressionMessage extends BridgeMessage {
  type: 'expression'
  name: string
}

export interface BridgeEmotionMessage extends BridgeMessage {
  type: 'emotion'
  value: string
}

export interface BridgeStatusMessage extends BridgeMessage {
  type: 'status'
  value: 'speaking' | 'idle'
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * WebSocket bridge client that connects to the Python LiveAPI bridge server.
 * Receives text, expression, emotion, and status messages.
 *
 * Auto-reconnects on disconnect with exponential backoff.
 */
export function useBridgeConnection(url?: string) {
  const bridgeUrl = ref(url || 'ws://localhost:8765')
  const bridgeConnected = ref(false)
  const bridgeText = ref('')
  const bridgeEmotion = ref('')
  const bridgeStatus = ref<'speaking' | 'idle' | 'unknown'>('unknown')
  const bridgeExpression = ref('')
  const bridgeEnabled = ref(false)

  // Message log (last N messages for subtitle display)
  const bridgeMessages = ref<BridgeMessage[]>([])
  const MAX_MESSAGES = 50

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000
  const MAX_RECONNECT_DELAY = 10000

  function connect() {
    if (ws) {
      ws.close()
      ws = null
    }

    try {
      ws = new WebSocket(bridgeUrl.value)

      ws.onopen = () => {
        bridgeConnected.value = true
        reconnectDelay = 1000 // Reset backoff on successful connect
        console.log(`[bridge] Connected to ${bridgeUrl.value}`)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as BridgeMessage
          handleMessage(msg)
        }
        catch (err) {
          console.warn('[bridge] Failed to parse message:', err)
        }
      }

      ws.onclose = () => {
        bridgeConnected.value = false
        console.log('[bridge] Disconnected')
        scheduleReconnect()
      }

      ws.onerror = (err) => {
        console.warn('[bridge] WebSocket error:', err)
        // onclose will fire after onerror, no need to reconnect here
      }
    }
    catch (err) {
      console.warn('[bridge] Failed to create WebSocket:', err)
      scheduleReconnect()
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.onclose = null // Prevent auto-reconnect
      ws.close()
      ws = null
    }
    bridgeConnected.value = false
  }

  function scheduleReconnect() {
    if (!bridgeEnabled.value)
      return
    if (reconnectTimer)
      return

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (bridgeEnabled.value) {
        console.log(`[bridge] Reconnecting (delay: ${reconnectDelay}ms)...`)
        connect()
        reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY)
      }
    }, reconnectDelay)
  }

  function handleMessage(msg: BridgeMessage) {
    // Store in message log
    bridgeMessages.value.push(msg)
    if (bridgeMessages.value.length > MAX_MESSAGES) {
      bridgeMessages.value.shift()
    }

    switch (msg.type) {
      case 'text': {
        const textMsg = msg as BridgeTextMessage
        if (textMsg.streaming) {
          bridgeText.value += textMsg.content
        }
        else {
          bridgeText.value = textMsg.content
        }
        break
      }
      case 'expression': {
        const exprMsg = msg as BridgeExpressionMessage
        bridgeExpression.value = exprMsg.name
        break
      }
      case 'emotion': {
        const emotionMsg = msg as BridgeEmotionMessage
        bridgeEmotion.value = emotionMsg.value
        break
      }
      case 'status': {
        const statusMsg = msg as BridgeStatusMessage
        bridgeStatus.value = statusMsg.value
        // Clear accumulated text on idle (new turn)
        if (statusMsg.value === 'idle') {
          bridgeText.value = ''
        }
        break
      }
    }
  }

  // Auto-connect/disconnect when enabled changes
  watch(bridgeEnabled, (enabled) => {
    if (enabled) {
      connect()
    }
    else {
      disconnect()
    }
  })

  return {
    bridgeUrl,
    bridgeConnected,
    bridgeEnabled,
    bridgeText,
    bridgeEmotion,
    bridgeStatus,
    bridgeExpression,
    bridgeMessages,
    connect,
    disconnect,
  }
}
