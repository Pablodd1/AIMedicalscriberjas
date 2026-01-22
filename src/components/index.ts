import React from 'react'
import { VoiceControlProvider, useVoiceControl } from './VoiceControlProvider'
import { VoiceControlPanel } from './VoiceControlPanel'
import type { VoiceRecognitionConfig, UserPreferences } from '@/types'

export interface VoiceControlProps {
  children: React.ReactNode
  config?: Partial<VoiceRecognitionConfig>
  preferences?: Partial<UserPreferences>
  onCommand?: (command: any) => void
  onError?: (error: Error) => void
  onStateChange?: (state: any) => void
}

export const VoiceControl: React.FC<VoiceControlProps> = ({
  children,
  config,
  preferences,
  onCommand,
  onError,
  onStateChange
}) => {
  return (
    <VoiceControlProvider
      config={config}
      preferences={preferences}
      onCommand={onCommand}
      onError={onError}
      onStateChange={onStateChange}
    >
      {children}
    </VoiceControlProvider>
  )
}

export { VoiceControlPanel, useVoiceControl }
export type { VoiceRecognitionConfig, UserPreferences } from '@/types'