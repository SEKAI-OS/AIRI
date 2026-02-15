import { useExpressionStore } from '@proj-airi/stage-ui-live2d'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useSettingsBridge } from '../stores/settings/bridge'
import { useBridgeConnection } from './use-bridge-connection'

/**
 * Wires bridge messages to the expression store.
 * When bridgeExpression changes, it calls expressionStore.set() to update the Live2D model.
 * When bridgeEmotion changes, it maps emotion names to expression groups.
 *
 * Call this once from the Stage component.
 */
export function useBridgeExpressionSync() {
  const settingsBridge = useSettingsBridge()
  const { bridgeEnabled: settingsEnabled, bridgeUrl: settingsUrl } = storeToRefs(settingsBridge)

  const bridge = useBridgeConnection(settingsUrl.value)

  // Sync settings -> bridge composable
  watch(settingsEnabled, (val) => {
    bridge.bridgeEnabled.value = val
  }, { immediate: true })

  watch(settingsUrl, (val) => {
    bridge.bridgeUrl.value = val
    // Reconnect if currently connected
    if (bridge.bridgeEnabled.value && bridge.bridgeConnected.value) {
      bridge.disconnect()
      bridge.connect()
    }
  })

  // Wire expression messages to expression store
  const expressionStore = useExpressionStore()

  watch(() => bridge.bridgeExpression.value, (name) => {
    if (!name)
      return
    const result = expressionStore.set(name, true, 5) // auto-reset after 5s
    if (!result.success) {
      console.warn(`[bridge-sync] Expression "${name}" not found:`, result.error)
    }
  })

  // Wire emotion messages to expression store
  // Map emotion values (from VoicePeak) to expression names
  watch(() => bridge.bridgeEmotion.value, (emotion) => {
    if (!emotion)
      return
    // Try direct mapping first (emotion name might match expression name)
    const result = expressionStore.set(emotion, true, 5)
    if (!result.success) {
      // Try common mappings
      const mapping: Record<string, string> = {
        'happy': 'Smile',
        'sad': 'Cry',
        'angry': 'Anger',
        'surprised': 'Surprise',
        'teto-overactive': 'Smile',
        'teto-low-key': 'Cry',
      }
      const mapped = mapping[emotion]
      if (mapped) {
        expressionStore.set(mapped, true, 5)
      }
    }
  })

  return {
    ...bridge,
    settingsEnabled,
    settingsUrl,
  }
}
