import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export const useSettingsBridge = defineStore('settings-bridge', () => {
  const bridgeEnabled = useLocalStorageManualReset<boolean>('settings/bridge/enabled', false)
  const bridgeUrl = useLocalStorageManualReset<string>('settings/bridge/url', 'ws://localhost:8765')

  function resetState() {
    bridgeEnabled.reset()
    bridgeUrl.reset()
  }

  return {
    bridgeEnabled,
    bridgeUrl,
    resetState,
  }
})
