import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVoiceControl } from './VoiceControlProvider'
import type { VoiceFeedback } from '@/types'

interface VoiceControlPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({ isOpen, onClose }) => {
  const { state, startListening, stopListening, updatePreferences, updateConfig } = useVoiceControl()
  const [activeTab, setActiveTab] = useState<'status' | 'settings' | 'commands'>('status')
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null)

  useEffect(() => {
    const handleFeedback = (event: CustomEvent) => {
      setFeedback(event.detail)
      setTimeout(() => setFeedback(null), event.detail.duration || 3000)
    }

    window.addEventListener('voice-feedback', handleFeedback as EventListener)
    return () => window.removeEventListener('voice-feedback', handleFeedback as EventListener)
  }, [])

  const handleStartListening = async () => {
    try {
      await startListening()
    } catch (error) {
      console.error('Failed to start listening:', error)
    }
  }

  const handleStopListening = () => {
    stopListening()
  }

  const handleWakeWordChange = (wakeWord: string) => {
    updatePreferences({ wakeWord })
    updateConfig({ wakeWord })
  }

  const handleLanguageChange = (language: string) => {
    updatePreferences({ language })
    updateConfig({ languages: [language] })
  }

  const handleSensitivityChange = (sensitivity: number) => {
    updatePreferences({ microphoneSensitivity: sensitivity })
    updateConfig({ confidenceThreshold: sensitivity / 10 })
  }

  const handleVoiceSpeedChange = (speed: number) => {
    updatePreferences({ voiceSpeed: speed })
  }

  const toggleCategory = (category: string) => {
    const currentCategories = state.preferences.enabledCategories
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category]
    
    updatePreferences({ enabledCategories: newCategories })
  }

  const getStatusColor = () => {
    if (state.isProcessing) return 'text-green-600'
    if (state.wakeWordDetected) return 'text-blue-600'
    if (state.isListening) return 'text-yellow-600'
    return 'text-gray-400'
  }

  const getStatusText = () => {
    if (state.isProcessing) return 'Processing command...'
    if (state.wakeWordDetected) return 'Listening for command...'
    if (state.isListening) return 'Waiting for wake word...'
    return 'Not listening'
  }

  const commands = [
    { category: 'Navigation', commands: [
      'Go to [page name]',
      'Back',
      'Home',
      'Scroll up/down',
      'Refresh page'
    ]},
    { category: 'Healthcare', commands: [
      'Search patient [name]',
      'Check in patient',
      'Collect signature',
      'Verify insurance',
      'Input date of birth'
    ]},
    { category: 'UI Actions', commands: [
      'Click [element]',
      'Submit form',
      'Search for [query]',
      'Select [option]',
      'Cancel/Confirm'
    ]},
    { category: 'Accessibility', commands: [
      'Read this page',
      'Describe screen',
      'What can I do here?',
      'List commands',
      'Help'
    ]}
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Voice Control</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {[
                { id: 'status', label: 'Status', icon: '🎤' },
                { id: 'settings', label: 'Settings', icon: '⚙️' },
                { id: 'commands', label: 'Commands', icon: '📋' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                {activeTab === 'status' && (
                  <motion.div
                    key="status"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${getStatusColor()} bg-opacity-10 mb-4`}>
                        <svg className={`w-10 h-10 ${getStatusColor()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v4a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{getStatusText()}</h3>
                      <p className="text-sm text-gray-500 mb-6">
                        Wake word: "{state.preferences.wakeWord}"
                      </p>
                      
                      <button
                        onClick={state.isListening ? handleStopListening : handleStartListening}
                        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                          state.isListening
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {state.isListening ? 'Stop Listening' : 'Start Listening'}
                      </button>
                    </div>

                    {state.currentCommand && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Last Command</h4>
                        <p className="text-sm text-gray-600 mb-1">"{state.currentCommand.action}"</p>
                        <p className="text-xs text-gray-500">
                          Confidence: {(state.currentCommand.confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                    )}

                    {state.recentCommands.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Commands</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {state.recentCommands.slice(0, 5).map((cmd, index) => (
                            <div key={cmd.id} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                              <span className="font-medium">{cmd.category}:</span> {cmd.action}
                              <span className="text-gray-400 ml-2">
                                ({(cmd.confidence * 100).toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Wake Word
                      </label>
                      <input
                        type="text"
                        value={state.preferences.wakeWord}
                        onChange={(e) => handleWakeWordChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Language
                      </label>
                      <select
                        value={state.preferences.language}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="zh-CN">Chinese</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Microphone Sensitivity: {state.preferences.microphoneSensitivity}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={state.preferences.microphoneSensitivity}
                        onChange={(e) => handleSensitivityChange(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Voice Speed: {state.preferences.voiceSpeed.toFixed(1)}x
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={state.preferences.voiceSpeed}
                        onChange={(e) => handleVoiceSpeedChange(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Enabled Command Categories
                      </label>
                      <div className="space-y-2">
                        {[
                          { id: 'navigation', label: 'Navigation Commands' },
                          { id: 'ui-action', label: 'UI Actions' },
                          { id: 'healthcare', label: 'Healthcare Commands' },
                          { id: 'workflow', label: 'Workflow Commands' },
                          { id: 'accessibility', label: 'Accessibility Commands' },
                          { id: 'system', label: 'System Commands' }
                        ].map(category => (
                          <label key={category.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={state.preferences.enabledCategories.includes(category.id)}
                              onChange={() => toggleCategory(category.id)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">{category.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Audio Feedback</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.preferences.audioFeedback}
                          onChange={(e) => updatePreferences({ audioFeedback: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Visual Feedback</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.preferences.visualFeedback}
                          onChange={(e) => updatePreferences({ visualFeedback: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'commands' && (
                  <motion.div
                    key="commands"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {commands.map((group, index) => (
                      <div key={index}>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">{group.category}</h4>
                        <div className="space-y-2">
                          {group.commands.map((command, cmdIndex) => (
                            <div key={cmdIndex} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                              {command}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">Tips</h4>
                      <ul className="text-xs text-blue-800 space-y-1">
                        <li>• Speak clearly and at a normal pace</li>
                        <li>• Use the wake word before commands</li>
                        <li>• Wait for confirmation before next command</li>
                        <li>• Say "help" for available commands</li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={`m-4 p-4 rounded-lg ${
                    feedback.type === 'success' ? 'bg-green-100 text-green-800' :
                    feedback.type === 'error' ? 'bg-red-100 text-red-800' :
                    feedback.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}
                >
                  <p className="text-sm font-medium">{feedback.message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}