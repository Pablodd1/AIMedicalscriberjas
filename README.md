# Healthcare Voice Control System

A comprehensive, hands-free voice control system designed specifically for healthcare kiosk applications. Built with TypeScript, React, and modern web technologies.

## Features

### 🎤 Voice Recognition
- **Wake Word Detection**: Customizable wake word (default: "Hey Healthcare")
- **Real-time Speech-to-Text**: <500ms latency with Web Speech API
- **Multi-language Support**: English, Spanish, French, Chinese with accent recognition
- **Confidence Scoring**: Minimum 70% confidence threshold
- **Background Noise Filtering**: Audio normalization and noise suppression

### 🧠 Natural Language Processing
- **Command Parsing**: Intelligent intent recognition for healthcare workflows
- **Entity Extraction**: Automatically extracts names, dates, phone numbers
- **Synonym Support**: Handles variations ("patient", "client", "person")
- **Fuzzy Matching**: Tolerates pronunciation differences and typos
- **Context Awareness**: Remembers previous commands in conversation

### 🏥 Healthcare-Specific Workflows
- **Patient Search**: Find patients by name, DOB, phone, or ID
- **Check-in Process**: Complete patient registration with confirmation
- **Signature Collection**: Digital signature capture with consent forms
- **Insurance Verification**: Automated insurance validation
- **Date of Birth Input**: Voice-guided DOB entry

### 🔒 Security & Privacy
- **Audio Encryption**: TLS 1.3 encryption for all voice data
- **Local Processing Option**: No cloud transmission for sensitive data
- **PII Anonymization**: Automatically removes personal information
- **Audit Trail**: Comprehensive security event logging
- **GDPR/CCPA Compliant**: Data retention controls and user consent

### ♿ Accessibility
- **WCAG 2.1 AA Compliant**: Full accessibility standard compliance
- **Screen Reader Compatible**: ARIA labels and semantic HTML
- **High Contrast Mode**: Support for visual impairments
- **Reduced Motion**: Respects user motion preferences
- **Keyboard Navigation**: Complete keyboard accessibility

### 🎯 User Experience
- **Visual Feedback**: Real-time command confirmation
- **Audio Feedback**: Text-to-speech responses
- **Element Highlighting**: Visual indication of target elements
- **Error Handling**: Graceful error recovery with suggestions
- **Multi-step Workflows**: Complex process automation

## Installation

```bash
npm install
# or
yarn install
```

## Usage

### Basic Integration

```tsx
import { VoiceControl, VoiceControlPanel, useVoiceControl } from 'voice-control-healthcare'

function App() {
  return (
    <VoiceControl
      config={{
        wakeWord: 'Hey Healthcare',
        languages: ['en-US'],
        confidenceThreshold: 0.7
      }}
      preferences={{
        language: 'en-US',
        voiceSpeed: 1.0,
        audioFeedback: true,
        visualFeedback: true
      }}
      onCommand={(command) => console.log('Command:', command)}
      onError={(error) => console.error('Error:', error)}
    >
      <YourApp />
      <VoiceControlPanel />
    </VoiceControl>
  )
}
```

### Voice Commands

#### Navigation
- "Hey Healthcare, go to patient search"
- "Hey Healthcare, back"
- "Hey Healthcare, home"
- "Hey Healthcare, scroll down"

#### Healthcare Operations
- "Hey Healthcare, search patient John Smith"
- "Hey Healthcare, check in patient"
- "Hey Healthcare, collect signature"
- "Hey Healthcare, verify insurance"

#### UI Actions
- "Hey Healthcare, click submit button"
- "Hey Healthcare, search for cardiology"
- "Hey Healthcare, select appointment"

#### Accessibility
- "Hey Healthcare, read this page"
- "Hey Healthcare, describe current screen"
- "Hey Healthcare, what can I do here?"
- "Hey Healthcare, help"

## Configuration

### Voice Recognition Config

```typescript
interface VoiceRecognitionConfig {
  wakeWord: string                    // Default: "Hey Healthcare"
  languages: string[]                 // Default: ["en-US"]
  confidenceThreshold: number         // Default: 0.7
  timeoutMs: number                     // Default: 5000
  noiseThreshold: number                // Default: 0.1
  sampleRate: number                    // Default: 44100
  bufferSize: number                    // Default: 2048
}
```

### User Preferences

```typescript
interface UserPreferences {
  language: string                      // Default: "en-US"
  accent: string                        // Default: "american"
  wakeWord: string                      // Default: "Hey Healthcare"
  microphoneSensitivity: number       // Default: 5 (1-10)
  voiceSpeed: number                    // Default: 1.0 (0.5-2.0)
  commandAliases: Record<string, string>
  enabledCategories: string[]
  audioFeedback: boolean                // Default: true
  visualFeedback: boolean               // Default: true
}
```

### Security Config

```typescript
interface SecurityConfig {
  encryptAudio: boolean                 // Default: true
  localProcessing: boolean              // Default: true
  requireAuthentication: boolean        // Default: false
  dataRetentionDays: number              // Default: 30
  sensitiveActions: string[]
  confirmationRequired: boolean       // Default: false
}
```

## Healthcare Workflows

### Patient Search Workflow
1. **Activation**: "Hey Healthcare, search patient [name]"
2. **Process**: Searches by name, DOB, phone, or patient ID
3. **Results**: Displays matching patients with details
4. **Selection**: Voice or touch selection of patient

### Check-in Workflow
1. **Patient Selection**: Select patient from search results
2. **Verification**: Confirm patient identity
3. **Visit Type**: Specify routine, urgent, follow-up, or new patient
4. **Copay**: Enter copay amount if applicable
5. **Confirmation**: Final check-in confirmation
6. **Completion**: Patient marked as checked in

### Signature Collection Workflow
1. **Consent Form**: Display consent form for review
2. **Confirmation**: Patient confirms understanding
3. **Signature Pad**: Activate signature collection area
4. **Signature**: Patient signs using finger or stylus
5. **Verification**: Confirm signature is complete
6. **Storage**: Secure signature storage

### Insurance Verification Workflow
1. **Insurance Card**: Scan or manually enter insurance information
2. **Verification**: Real-time insurance validation
3. **Coverage**: Display coverage details
4. **Confirmation**: Confirm insurance is valid

## Multi-language Support

### Supported Languages
- **English (US/UK/Australia/Canada/India)**
- **Spanish (Spain/Mexico/Argentina/Colombia/US)**
- **French (France/Canada/Belgium/Switzerland)**
- **Chinese (Simplified/Traditional)**

### Accent Detection
- Automatic accent recognition based on speech patterns
- Regional vocabulary and pronunciation adaptation
- Customizable accent preferences

### Language Configuration

```typescript
const multiLang = new MultiLanguageSupport()

// Get supported languages
const languages = multiLang.getSupportedLanguages()

// Get language-specific config
const config = multiLang.getLanguageConfig('es-ES')

// Detect accent
const accent = multiLang.detectAccent(transcript, 'es-ES')

// Normalize text
const normalized = multiLang.normalizeTranscript(transcript, 'es-ES')
```

## Security Features

### Data Protection
- **Encryption**: All audio data encrypted with AES-256-GCM
- **Local Processing**: Option for completely local voice processing
- **Anonymization**: Automatic PII removal from transcripts
- **Audit Trail**: Complete security event logging

### Privacy Controls
- **Consent Management**: User consent for voice data collection
- **Data Retention**: Configurable data retention periods
- **Right to Deletion**: User data deletion capabilities
- **Transparency**: Clear data usage policies

### Compliance
- **HIPAA Compliant**: Healthcare data protection standards
- **GDPR Compliant**: European privacy regulations
- **CCPA Compliant**: California privacy regulations
- **WCAG 2.1 AA**: Accessibility standards

## Performance Specifications

### Response Times
- **Wake Word Detection**: <300ms
- **Command Recognition**: <800ms
- **Action Execution**: <500ms (excluding network)
- **Total Response Time**: <2 seconds

### Accuracy Requirements
- **Recognition Accuracy**: ≥95% for clear speech
- **Command Parsing Accuracy**: ≥90% for healthcare commands
- **Confidence Threshold**: 70% minimum

### Resource Usage
- **Memory Overhead**: <50MB additional
- **CPU Usage**: <5% when idle, <20% when processing
- **Browser Support**: Latest 2 versions of Chrome, Firefox, Safari, Edge

## Browser Compatibility

### Supported Browsers
- **Chrome**: Version 80+
- **Firefox**: Version 75+
- **Safari**: Version 13+
- **Edge**: Version 80+

### Required APIs
- **Web Speech API**: For voice recognition
- **Web Audio API**: For audio processing
- **MediaDevices API**: For microphone access
- **Crypto API**: For encryption

## Demo Application

### Running the Demo
```bash
cd demo
npm install
npm run dev
```

### Demo Features
- **Patient Search**: Voice-activated patient lookup
- **Check-in Process**: Complete voice-guided check-in
- **Signature Collection**: Digital signature with voice confirmation
- **Multi-language**: Switch between supported languages
- **Accessibility**: Full screen reader and keyboard support

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

## Documentation

### API Reference
- [VoiceRecognitionEngine](./docs/VoiceRecognitionEngine.md)
- [NaturalLanguageProcessor](./docs/NaturalLanguageProcessor.md)
- [ElementDetector](./docs/ElementDetector.md)
- [ActionExecutor](./docs/ActionExecutor.md)
- [HealthcareWorkflowEngine](./docs/HealthcareWorkflowEngine.md)

### Integration Guides
- [React Integration](./docs/react-integration.md)
- [Vue Integration](./docs/vue-integration.md)
- [Angular Integration](./docs/angular-integration.md)
- [Vanilla JS Integration](./docs/vanilla-js-integration.md)

### Deployment
- [Production Deployment](./docs/deployment.md)
- [Docker Setup](./docs/docker.md)
- [Kubernetes Setup](./docs/kubernetes.md)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please contact:
- Email: support@healthcarevoice.com
- Documentation: [https://docs.healthcarevoice.com](https://docs.healthcarevoice.com)
- Issues: [GitHub Issues](https://github.com/healthcarevoice/voice-control-system/issues)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.