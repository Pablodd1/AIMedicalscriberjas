# Voice Recording and Transcription Integration Guide

## Overview

This guide provides comprehensive instructions for integrating the advanced voice recording and transcription system into your healthcare application. The system supports medical-grade voice recording, real-time transcription, AI-powered medical data extraction, and comprehensive error handling.

## Architecture Components

### Frontend Components

#### EnhancedVoiceRecorder Component
```typescript
import { EnhancedVoiceRecorder } from '@/components/enhanced-voice-recorder';

<EnhancedVoiceRecorder
  onRecordingComplete={handleRecordingComplete}
  onTranscriptionUpdate={handleTranscriptionUpdate}
  enableRealTimeTranscription={true}
  medicalContext={true}
  maxRecordingTime={300} // 5 minutes
  language="en-US"
  enableAudioVisualization={true}
/>
```

**Props:**
- `onRecordingComplete`: Callback when recording finishes
- `onTranscriptionUpdate`: Real-time transcription updates
- `enableRealTimeTranscription`: Enable live transcription
- `medicalContext`: Enable medical terminology processing
- `maxRecordingTime`: Maximum recording duration in seconds
- `language`: Language code for transcription
- `enableAudioVisualization`: Show audio waveform

#### AIIntakeForm Component
```typescript
import { AIIntakeForm } from '@/components/ai-intake-form';

<AIIntakeForm
  uniqueLink={intakeLink}
  enableVoiceCommands={true}
  enableAIEnhancement={true}
  onComplete={handleIntakeComplete}
  onError={handleIntakeError}
/>
```

#### AdvancedVoiceCommandControl Component
```typescript
import { AdvancedVoiceCommandControl } from '@/components/advanced-voice-command-control';

<AdvancedVoiceCommandControl
  enableMedicalCommands={true}
  enableVoiceShortcuts={true}
  customCommands={customVoiceCommands}
  onCommandRecognized={handleCommand}
/>
```

### Backend Services

#### AdvancedTranscriptionService

```typescript
import { AdvancedTranscriptionService } from '@/server/advanced-transcription-service';

const transcriptionService = new AdvancedTranscriptionService({
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  googleCloudKey: process.env.GOOGLE_CLOUD_KEY,
  enableMedicalContext: true,
  cacheEnabled: true,
  cacheTtl: 3600 // 1 hour
});

// Transcribe audio with medical context
const result = await transcriptionService.transcribe({
  audioFile: audioBuffer,
  language: 'en-US',
  enableMedicalTerms: true,
  enableDiarization: true,
  enableConfidenceScoring: true
});
```

#### AIIntakeExtractor

```typescript
import { AIIntakeExtractor } from '@/server/ai-intake-extractor';

const extractor = new AIIntakeExtractor(process.env.OPENAI_API_KEY);

// Extract medical data from transcript
const extractedData = await extractor.extractMedicalData(transcript, 'en-US');

// Generate clinical summary
const clinicalSummary = await extractor.generateClinicalSummary(extractedData, patientId);
```

## API Endpoints

### Voice Recording and Transcription

#### POST /api/ai/transcribe
Transcribe audio file using multiple providers.

**Request:**
```http
POST /api/ai/transcribe
Content-Type: multipart/form-data

audio: <audio_file>
language: en-US
medicalContext: true
enableDiarization: false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript": "Patient reports chest pain for 3 days...",
    "confidence": 0.95,
    "language": "en-US",
    "duration": 45.2,
    "wordCount": 156,
    "medicalTerms": ["chest pain", "dyspnea", "palpitations"],
    "speakerDiarization": [
      {
        "speaker": 0,
        "startTime": 0.0,
        "endTime": 15.3,
        "text": "Patient reports chest pain for 3 days"
      }
    ]
  }
}
```

#### POST /api/ai-intake/extract-answers
Extract structured intake answers from transcript.

**Request:**
```http
POST /api/ai-intake/extract-answers
Content-Type: application/json

{
  "transcript": "My name is John Doe, I'm 35 years old...",
  "formId": "intake_1234567890_abc123",
  "language": "en-US"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "extractedAnswers": {
      "full_name": "John Doe",
      "date_of_birth": "1988-01-15",
      "phone": "+1-555-123-4567",
      "reason_for_visit": "Chest pain for 3 days"
    },
    "confidence": 0.92,
    "processingTime": 1.8
  }
}
```

#### POST /api/clinical-summary/generate
Generate clinical summary from transcript.

**Request:**
```http
POST /api/clinical-summary/generate
Content-Type: application/json

{
  "transcript": "Patient reports chest pain...",
  "patientId": "patient_123",
  "noteType": "SOAP",
  "includeCoding": true,
  "includeRiskAssessment": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clinicalSummary": {
      "subjective": "35-year-old male reports chest pain...",
      "objective": "Vital signs stable, no acute distress...",
      "assessment": "Chest pain, rule out cardiac etiology",
      "plan": "ECG, cardiac enzymes, chest X-ray"
    },
    "icd10Codes": ["R06.02", "I25.10"],
    "cptCodes": ["93000", "71020"],
    "riskAssessment": {
      "cardiovascular": "Moderate risk",
      "overall": "Low-moderate risk"
    }
  }
}
```

### Intake Forms

#### POST /api/public/intake-form/:formId/responses
Submit intake form responses.

**Request:**
```http
POST /api/public/intake-form/intake_1234567890_abc123/responses
Content-Type: application/json

{
  "questionId": 1,
  "question": "What is your full name?",
  "answer": "John Doe",
  "answerType": "text",
  "audioUrl": "https://storage.example.com/audio/response_123.webm"
}
```

#### POST /api/public/intake-form/:formId/complete
Complete intake form submission.

**Request:**
```http
POST /api/public/intake-form/intake_1234567890_abc123/complete
Content-Type: application/json

{
  "responses": [...],
  "summary": "Patient completed comprehensive intake form"
}
```

### Patient Import

#### POST /api/patient-import/epic
Import patient from Epic EHR.

**Request:**
```http
POST /api/patient-import/epic
Content-Type: application/json

{
  "patientId": "epic_patient_123",
  "facilityId": "facility_456",
  "includeMedicalHistory": true,
  "includeMedications": true,
  "includeAllergies": true
}
```

#### POST /api/patient-import/hl7
Import patient from HL7 message.

**Request:**
```http
POST /api/patient-import/hl7
Content-Type: text/plain

MSH|^~\&|SENDING_SYSTEM|FACILITY|RECEIVING_SYSTEM|FACILITY|20240127120000||ADT^A08|12345|P|2.5
PID|1||12345678^^^FACILITY^MR||DOE^JOHN^MIDDLE||19800115|M|||123 MAIN ST^^ANYTOWN^ST^12345^USA
...
```

## Configuration

### Environment Variables

```bash
# Required for transcription services
DEEPGRAM_API_KEY=your_deepgram_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CLOUD_KEY=your_google_cloud_key

# Optional for enhanced features
REDIS_URL=redis://localhost:6379
ENABLE_REAL_TIME_TRANSCRIPTION=true
ENABLE_MEDICAL_CONTEXT=true
MAX_RECORDING_TIME=300

# Security
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/healthcare_db
```

### Feature Flags

```typescript
// Enable/disable features
const features = {
  enableVoiceRecording: true,
  enableRealTimeTranscription: true,
  enableMedicalContext: true,
  enableAIEnhancement: true,
  enableVoiceCommands: true,
  enablePatientImport: true,
  enableClinicalSummaries: true,
  enableCaching: true
};
```

## Integration Steps

### 1. Install Dependencies

```bash
# Frontend dependencies
cd client && npm install lucide-react @radix-ui/react-dialog

# Backend dependencies
cd server && npm install @deepgram/sdk openai @google-cloud/speech redis ioredis
```

### 2. Configure Environment Variables

Create `.env` files in both client and server directories with the required API keys and configuration.

### 3. Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 4. Start Services

```bash
# Start backend server
cd server && npm run dev

# Start frontend development server
cd client && npm run dev

# Start Redis (if using caching)
redis-server
```

### 5. Test Integration

```bash
# Run comprehensive tests
npm run test

# Run specific voice tests
npm run test:voice

# Run integration tests
npm run test:integration
```

## Error Handling

### Frontend Error Handling

```typescript
const handleRecordingError = (error: RecordingError) => {
  switch (error.code) {
    case 'NOT_ALLOWED_ERROR':
      toast.error('Microphone access denied. Please enable microphone permissions.');
      break;
    case 'NOT_FOUND_ERROR':
      toast.error('No microphone found. Please connect a microphone.');
      break;
    case 'NOT_SUPPORTED_ERROR':
      toast.error('Voice recording not supported in this browser.');
      break;
    case 'ABORTED_ERROR':
      toast.error('Recording was interrupted. Please try again.');
      break;
    default:
      toast.error(`Recording error: ${error.message}`);
  }
};
```

### Backend Error Handling

```typescript
const handleTranscriptionError = (error: TranscriptionError) => {
  logger.error('Transcription failed:', error);
  
  if (error.code === 'API_LIMIT_EXCEEDED') {
    // Fallback to alternative provider
    return fallbackTranscription(audioFile);
  }
  
  if (error.code === 'NETWORK_ERROR') {
    // Retry with exponential backoff
    return retryTranscription(audioFile);
  }
  
  throw new AppError(`Transcription failed: ${error.message}`, 'TRANSCRIPTION_FAILED');
};
```

## Performance Optimization

### Caching Strategy

```typescript
// Cache transcription results
const cacheKey = `transcription:${hash(audioBuffer)}:${language}`;
const cachedResult = await cache.get(cacheKey);

if (cachedResult) {
  return cachedResult;
}

// Process and cache result
const result = await processTranscription(audioBuffer, language);
await cache.set(cacheKey, result, 3600); // 1 hour TTL
```

### Audio Compression

```typescript
// Compress audio before processing
const compressedAudio = await compressAudio(audioBuffer, {
  format: 'webm',
  bitrate: '64k',
  sampleRate: 16000
});
```

### Progressive Enhancement

```typescript
// Load features progressively
const loadVoiceFeatures = async () => {
  if (supportsWebSpeechAPI()) {
    enableRealTimeTranscription();
  }
  
  if (supportsWebAudioAPI()) {
    enableAudioVisualization();
  }
  
  if (supportsMediaRecorder()) {
    enableVoiceRecording();
  }
};
```

## Security Considerations

### Data Protection

```typescript
// Encrypt sensitive data
const encryptAudioData = (audioBuffer: ArrayBuffer) => {
  return crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    encryptionKey,
    audioBuffer
  );
};
```

### Access Control

```typescript
// Implement role-based access
const requireMedicalRole = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.roles?.includes('medical_staff')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
```

### Audit Logging

```typescript
// Log all voice interactions
const logVoiceInteraction = (interaction: VoiceInteraction) => {
  auditLogger.info('Voice interaction', {
    userId: interaction.userId,
    action: interaction.action,
    timestamp: interaction.timestamp,
    metadata: interaction.metadata
  });
};
```

## Testing

### Unit Tests

```typescript
describe('EnhancedVoiceRecorder', () => {
  it('should handle recording start/stop', async () => {
    const recorder = new EnhancedVoiceRecorder();
    await recorder.startRecording();
    expect(recorder.isRecording()).toBe(true);
    
    const recording = await recorder.stopRecording();
    expect(recording).toBeDefined();
    expect(recording.duration).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('Voice Recording Integration', () => {
  it('should complete full recording and transcription flow', async () => {
    // Start recording
    const recording = await startVoiceRecording();
    
    // Simulate audio input
    await simulateAudioInput(recording.id, testAudioData);
    
    // Stop recording and get transcript
    const result = await stopVoiceRecording(recording.id);
    
    expect(result.transcript).toContain('test medical terminology');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
```

## Monitoring and Analytics

### Performance Metrics

```typescript
// Track transcription performance
const trackTranscriptionMetrics = (metrics: TranscriptionMetrics) => {
  analytics.track('transcription_completed', {
    duration: metrics.duration,
    wordCount: metrics.wordCount,
    confidence: metrics.confidence,
    processingTime: metrics.processingTime,
    provider: metrics.provider
  });
};
```

### Usage Analytics

```typescript
// Track voice feature usage
const trackVoiceUsage = (usage: VoiceUsage) => {
  analytics.track('voice_feature_used', {
    feature: usage.feature,
    frequency: usage.frequency,
    successRate: usage.successRate,
    userFeedback: usage.userFeedback
  });
};
```

## Troubleshooting

### Common Issues

1. **Microphone not detected**
   - Check browser permissions
   - Verify microphone hardware
   - Test with other applications

2. **Transcription accuracy low**
   - Check audio quality
   - Verify language settings
   - Consider medical context training

3. **Recording interruptions**
   - Check network stability
   - Monitor browser memory usage
   - Implement reconnection logic

4. **API rate limits exceeded**
   - Implement request queuing
   - Use caching effectively
   - Consider premium API tiers

### Debug Mode

```typescript
// Enable debug logging
const enableDebugMode = () => {
  localStorage.setItem('voice_debug', 'true');
  console.log('Voice recording debug mode enabled');
};

// View debug information
const getDebugInfo = () => {
  return {
    browserInfo: navigator.userAgent,
    microphonePermissions: microphoneStatus,
    recordingSupported: supportsRecording(),
    transcriptionProviders: availableProviders,
    cacheStatus: cacheStatus
  };
};
```

## Support and Resources

### Documentation
- [Voice Recording Architecture](./voice-recording-transcription-architecture.md)
- [API Reference](./api-reference.md)
- [Security Guidelines](./security-guidelines.md)

### Support Channels
- Technical Issues: GitHub Issues
- Feature Requests: GitHub Discussions
- General Support: support@healthcare-app.com

### Contributing
Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.