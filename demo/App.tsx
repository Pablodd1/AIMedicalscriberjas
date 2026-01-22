import React, { useState } from 'react'
import { VoiceControl, VoiceControlPanel, useVoiceControl } from '../src/components'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'

// Sample patient data for demo
const samplePatients = [
  {
    id: 'P001',
    firstName: 'John',
    lastName: 'Smith',
    dateOfBirth: '1985-03-15',
    phoneNumber: '(555) 123-4567',
    email: 'john.smith@email.com',
    insuranceNumber: 'INS123456789',
    lastVisit: '2024-01-15',
    status: 'active'
  },
  {
    id: 'P002',
    firstName: 'Sarah',
    lastName: 'Johnson',
    dateOfBirth: '1992-07-22',
    phoneNumber: '(555) 987-6543',
    email: 'sarah.j@email.com',
    insuranceNumber: 'INS987654321',
    lastVisit: '2024-01-10',
    status: 'active'
  },
  {
    id: 'P003',
    firstName: 'Michael',
    lastName: 'Brown',
    dateOfBirth: '1978-11-08',
    phoneNumber: '(555) 456-7890',
    email: 'm.brown@email.com',
    insuranceNumber: 'INS456789123',
    lastVisit: '2024-01-08',
    status: 'active'
  }
]

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'search' | 'checkin' | 'signature' | 'complete'>('search')
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isListening, setIsListening] = useState(false)
  const [voicePanelOpen, setVoicePanelOpen] = useState(false)
  const [checkInComplete, setCheckInComplete] = useState(false)
  const [signatureData, setSignatureData] = useState<string>('')

  const handleVoiceCommand = (command: any) => {
    console.log('Voice command received:', command)
    
    switch (command.category) {
      case 'navigation':
        handleNavigationCommand(command)
        break
      case 'healthcare':
        handleHealthcareCommand(command)
        break
      case 'ui-action':
        handleUiActionCommand(command)
        break
      case 'accessibility':
        handleAccessibilityCommand(command)
        break
    }
  }

  const handleNavigationCommand = (command: any) => {
    const action = command.action.toLowerCase()
    
    if (action.includes('search') || action.includes('find patient')) {
      setCurrentView('search')
    } else if (action.includes('check') && action.includes('in')) {
      if (selectedPatient) {
        setCurrentView('checkin')
      }
    } else if (action.includes('signature') || action.includes('sign')) {
      setCurrentView('signature')
    } else if (action.includes('home') || action.includes('dashboard')) {
      setCurrentView('search')
      setSelectedPatient(null)
      setCheckInComplete(false)
    }
  }

  const handleHealthcareCommand = (command: any) => {
    const action = command.action.toLowerCase()
    
    if (action.includes('patient') && action.includes('search')) {
      const searchTerm = action.replace(/patient search|search patient/i, '').trim()
      if (searchTerm) {
        performPatientSearch(searchTerm)
      }
    } else if (action.includes('check') && action.includes('in')) {
      if (selectedPatient) {
        setCurrentView('checkin')
      }
    } else if (action.includes('signature')) {
      setCurrentView('signature')
    }
  }

  const handleUiActionCommand = (command: any) => {
    const action = command.action.toLowerCase()
    
    if (action.includes('click') || action.includes('select')) {
      const target = action.replace(/click|select|press|tap/i, '').trim()
      handleClickCommand(target)
    } else if (action.includes('submit') || action.includes('confirm')) {
      handleSubmitCommand()
    }
  }

  const handleAccessibilityCommand = (command: any) => {
    const action = command.action.toLowerCase()
    
    if (action.includes('read') || action.includes('describe')) {
      readCurrentScreen()
    } else if (action.includes('help') || action.includes('commands')) {
      setVoicePanelOpen(true)
    }
  }

  const handleClickCommand = (target: string) => {
    if (target.includes('patient') && searchResults.length > 0) {
      setSelectedPatient(searchResults[0])
    } else if (target.includes('check') && target.includes('in') && selectedPatient) {
      setCurrentView('checkin')
    } else if (target.includes('signature')) {
      setCurrentView('signature')
    } else if (target.includes('search') || target.includes('find')) {
      setCurrentView('search')
    }
  }

  const handleSubmitCommand = () => {
    if (currentView === 'checkin') {
      completeCheckIn()
    } else if (currentView === 'signature') {
      completeSignature()
    }
  }

  const handleSubmitCommand = () => {
    if (currentView === 'checkin') {
      completeCheckIn()
    } else if (currentView === 'signature') {
      completeSignature()
    }
  }

  const performPatientSearch = (query: string) => {
    setSearchQuery(query)
    
    // Simulate search results
    const results = samplePatients.filter(patient => 
      patient.firstName.toLowerCase().includes(query.toLowerCase()) ||
      patient.lastName.toLowerCase().includes(query.toLowerCase()) ||
      patient.phoneNumber.includes(query) ||
      patient.id.toLowerCase().includes(query.toLowerCase())
    )
    
    setSearchResults(results)
  }

  const completeCheckIn = () => {
    setCheckInComplete(true)
    setTimeout(() => {
      setCurrentView('complete')
    }, 2000)
  }

  const completeSignature = () => {
    setSignatureData('signature_' + Date.now())
    setTimeout(() => {
      setCurrentView('complete')
    }, 1500)
  }

  const readCurrentScreen = () => {
    let content = ''
    
    switch (currentView) {
      case 'search':
        content = 'Patient search screen. Say "search patient" followed by a name, or "go to check in" to check in a patient.'
        break
      case 'checkin':
        content = `Check-in screen for ${selectedPatient?.firstName} ${selectedPatient?.lastName}. Say "confirm check-in" to complete the process.`
        break
      case 'signature':
        content = 'Signature collection screen. Please sign using your finger or say "complete signature" when done.'
        break
      case 'complete':
        content = 'Process complete. Say "go to home" to return to the main screen.'
        break
    }
    
    // Use speech synthesis to read the content
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(content)
      utterance.rate = 0.9
      speechSynthesis.speak(utterance)
    }
  }

  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      performPatientSearch(searchQuery)
    }
  }

  return (
    <VoiceControl
      config={{
        wakeWord: 'Hey Healthcare',
        languages: ['en-US'],
        confidenceThreshold: 0.7,
        timeoutMs: 5000
      }}
      preferences={{
        language: 'en-US',
        accent: 'american',
        wakeWord: 'Hey Healthcare',
        microphoneSensitivity: 5,
        voiceSpeed: 1.0,
        commandAliases: {
          'doc': 'go to dashboard',
          'sig': 'collect signature'
        },
        enabledCategories: ['navigation', 'ui-action', 'healthcare', 'accessibility'],
        audioFeedback: true,
        visualFeedback: true
      }}
      onCommand={handleVoiceCommand}
      onError={(error) => console.error('Voice control error:', error)}
    >
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <h1 className="text-2xl font-bold text-gray-900">Healthcare Kiosk</h1>
                </div>
                <div className="hidden md:block ml-10">
                  <div className="flex items-baseline space-x-4">
                    <span className="text-gray-500">Hands-free voice control enabled</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setVoicePanelOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Voice Settings
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            {currentView === 'search' && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow-lg p-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Patient Search</h2>
                
                <form onSubmit={handleSearchSubmit} className="mb-8">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, phone, or ID..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                      Search
                    </button>
                  </div>
                </form>

                {searchResults.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
                    {searchResults.map((patient) => (
                      <motion.div
                        key={patient.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedPatient?.id === patient.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </h4>
                            <p className="text-sm text-gray-600">ID: {patient.id}</p>
                            <p className="text-sm text-gray-600">DOB: {patient.dateOfBirth}</p>
                            <p className="text-sm text-gray-600">Phone: {patient.phoneNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Last Visit: {patient.lastVisit}</p>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {patient.status}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {selectedPatient && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <h3 className="text-lg font-semibold text-green-900 mb-4">Selected Patient</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-green-700">Name</p>
                        <p className="font-medium text-green-900">
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700">ID</p>
                        <p className="font-medium text-green-900">{selectedPatient.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700">Date of Birth</p>
                        <p className="font-medium text-green-900">{selectedPatient.dateOfBirth}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700">Insurance</p>
                        <p className="font-medium text-green-900">{selectedPatient.insuranceNumber}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex gap-4">
                      <button
                        onClick={() => setCurrentView('checkin')}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
                      >
                        Check In Patient
                      </button>
                      <button
                        onClick={() => setCurrentView('signature')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                      >
                        Collect Signature
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {currentView === 'checkin' && (
              <motion.div
                key="checkin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow-lg p-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Patient Check-in</h2>
                
                {selectedPatient && (
                  <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">Patient Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-blue-700">Name</p>
                        <p className="font-medium text-blue-900">
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">Date of Birth</p>
                        <p className="font-medium text-blue-900">{selectedPatient.dateOfBirth}</p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">Phone</p>
                        <p className="font-medium text-blue-900">{selectedPatient.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">Insurance</p>
                        <p className="font-medium text-blue-900">{selectedPatient.insuranceNumber}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visit Type
                    </label>
                    <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="routine">Routine Check-up</option>
                      <option value="urgent">Urgent Care</option>
                      <option value="follow-up">Follow-up Visit</option>
                      <option value="new-patient">New Patient</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Copay Amount
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm text-gray-700">
                        I confirm that the patient information is correct and consent to treatment.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    onClick={() => setCurrentView('search')}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Back to Search
                  </button>
                  <button
                    onClick={completeCheckIn}
                    disabled={checkInComplete}
                    className={`px-6 py-3 rounded-lg transition-colors ${
                      checkInComplete
                        ? 'bg-green-600 text-white cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {checkInComplete ? 'Check-in Complete ✓' : 'Complete Check-in'}
                  </button>
                </div>
              </motion.div>
            )}

            {currentView === 'signature' && (
              <motion.div
                key="signature"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow-lg p-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Collect Signature</h2>
                
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Consent Form</h3>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700 mb-4">
                      I hereby consent to the treatment and agree to the terms and conditions
                      outlined by the healthcare provider.
                    </p>
                    <p className="text-xs text-gray-600">
                      Please sign below to indicate your acceptance of these terms.
                    </p>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Signature Area</h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-gray-500 mb-4">
                      {signatureData ? 'Signature collected ✓' : 'Please sign here using your finger or stylus'}
                    </p>
                    {signatureData && (
                      <div className="text-green-600 font-medium">
                        Signature ID: {signatureData}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentView('search')}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Back to Search
                  </button>
                  <button
                    onClick={completeSignature}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Complete Signature
                  </button>
                </div>
              </motion.div>
            )}

            {currentView === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow-lg p-6 text-center"
              >
                <div className="mb-8">
                  <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-6">
                    <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Process Complete!</h2>
                  <p className="text-lg text-gray-600 mb-8">
                    The patient has been successfully checked in and all required signatures have been collected.
                  </p>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setCurrentView('search')
                      setSelectedPatient(null)
                      setCheckInComplete(false)
                      setSignatureData('')
                      setSearchResults([])
                      setSearchQuery('')
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg transition-colors text-lg font-medium"
                  >
                    Return to Home
                  </button>
                  <p className="text-sm text-gray-500">
                    Or say "Hey Healthcare, go to home" to return to the main screen.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Voice Control Panel */}
        <VoiceControlPanel
          isOpen={voicePanelOpen}
          onClose={() => setVoicePanelOpen(false)}
        />

        {/* Instructions */}
        <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
          <h3 className="font-semibold text-gray-900 mb-2">Voice Commands</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• "Hey Healthcare, search patient [name]"</p>
            <p>• "Hey Healthcare, check in patient"</p>
            <p>• "Hey Healthcare, collect signature"</p>
            <p>• "Hey Healthcare, go to home"</p>
            <p>• "Hey Healthcare, help"</p>
          </div>
        </div>
      </div>
    </VoiceControl>
  )
}

export default App