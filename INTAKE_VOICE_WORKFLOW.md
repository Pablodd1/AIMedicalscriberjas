# Patient Intake Voice Form - Complete Workflow Documentation

## Overview

The Patient Intake Voice Form system allows patients to complete intake forms using voice input, text input, or a combination of both. This document explains the complete workflow from creation to submission.

---

## System Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Doctor/Admin  │ ───────▶│  Intake Form     │◀────────│   Patient       │
│   Dashboard     │ Creates │  Management      │ Fills   │   (Public)      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │                             │
        │                            │                             │
        ▼                            ▼                             ▼
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│ /patient-intake │         │   Database       │         │  /patient-join  │
│     Page        │         │   (Neon          │         │   /[uniqueLink] │
└─────────────────┘         │   PostgreSQL)    │         └─────────────────┘
                            └──────────────────┘
```

---

## Workflow Steps

### Step 1: Doctor Creates Intake Form

**Location:** `/patient-intake` page (Admin/Doctor only)

**Process:**
1. Doctor logs into the system
2. Navigates to "Patient Intake" page
3. Clicks "Create New Intake Form" button
4. Fills out form:
   - Selects patient from dropdown
   - Name auto-fills from patient record
   - Email auto-fills from patient record
   - Phone (optional)
5. System generates unique link: `intake_[timestamp]_[random]`
6. Form is saved to database with status: "pending"

**Database Table:** `intake_forms`
```sql
{
  id: serial,
  patientId: integer,
  doctorId: integer,
  name: text,
  email: text,
  phone: text (optional),
  uniqueLink: text (unique),
  status: 'pending' | 'completed' | 'expired',
  createdAt: timestamp,
  expiresAt: timestamp (optional)
}
```

**API Endpoint:**
```
POST /api/intake-forms
Body: {
  patientId: number,
  name: string,
  email: string,
  phone: string (optional),
  uniqueLink: string,
  status: "pending"
}
```

---

### Step 2: Share Link with Patient

**Location:** `/patient-intake` page (List view)

**Options:**
1. **Copy Link** - Copy to clipboard
2. **View Full Link** - Shows dialog with full URL
3. **Send via Email** - Opens mailto link with pre-filled message
4. **Preview** - Opens form in new tab for testing

**Full Link Format:**
```
https://your-domain.com/patient-join/intake_1703123456_abc123
```

---

### Step 3: Patient Opens Link

**Location:** `/patient-join/:uniqueLink` (Public page, no auth required)

**Process:**
1. System fetches form data using unique link
2. Validates form exists and is not expired
3. Shows welcome screen with:
   - Form title
   - Doctor/Practice name
   - Instructions
   - Progress indicator (Question X of 30)

**API Endpoint:**
```
GET /api/public/intake-form/:uniqueLink
Returns: IntakeForm with status and details
```

---

### Step 4: Patient Answers Questions

**Interface Components:**

1. **Question Display**
   - Shows current question text
   - Indicates if mandatory (red asterisk)
   - Shows question number (e.g., "Question 5 of 30")

2. **Input Options**
   - **Text Input:** Large textarea for typing answer
   - **Voice Input:** Microphone button to record voice

3. **Progress Bar**
   - Visual progress: "X of 30 completed"
   - Percentage bar showing completion

4. **Navigation**
   - Previous button (go back to edit)
   - Next button (save and move forward)
   - Question number grid (quick jump)

---

### Step 5: Voice Recording Process

**How Voice Input Works:**

1. **Start Recording:**
   - Patient clicks microphone button
   - System requests microphone permission
   - Recording starts (MediaRecorder API)
   - Button turns red with pulsing animation
   - Shows "REC" indicator with live timer

2. **During Recording:**
   - **Option A:** Live transcription (if supported)
     - Uses Web Speech API (Chrome/Edge)
     - Shows transcript in real-time
     - Continues until patient stops
   
   - **Option B:** Post-recording transcription (fallback)
     - Records audio only
     - Transcribes after stopping using backend API

3. **Audio Feedback (if implemented):**
   - Audio level meter (shows mic is working)
   - Waveform visualization
   - "Audio detected" or "Waiting for audio" status

4. **Stop Recording:**
   - Patient clicks stop button (red mic icon)
   - Recording stops
   - Audio is sent to backend for transcription
   - Transcript appears in textarea
   - Patient can edit or re-record

**Recording Service Methods:**
```typescript
recordingService.startRecording()
  ├─> Requests microphone permission
  ├─> Creates MediaRecorder
  ├─> Stores audio chunks
  └─> Sets isRecording = true

recordingService.stopRecording()
  ├─> Stops MediaRecorder
  ├─> Combines audio chunks into Blob
  ├─> Sends to /api/ai/transcribe
  ├─> Returns transcript text
  └─> Sets isRecording = false

recordingService.getTranscript()
  └─> Returns transcribed text
```

---

### Step 6: Transcription Process

**Backend Transcription Flow:**

```
Audio File → Backend API → Deepgram/OpenAI → Transcript Text
```

**API Endpoint:**
```
POST /api/ai/transcribe
Content-Type: multipart/form-data
Body: audio file (WebM format)

Returns: {
  transcript: string,
  provider: 'deepgram-nova-2-medical' | 'openai-whisper'
}
```

**Provider Priority:**
1. **Deepgram** (if DEEPGRAM_API_KEY set)
   - Model: `nova-2-medical` (optimized for medical terminology)
   - Fast and accurate
   - Preferred for medical forms

2. **OpenAI Whisper** (fallback)
   - Model: `whisper-1`
   - Works if Deepgram unavailable
   - General-purpose transcription

**Transcript Quality:**
- Smart formatting enabled
- Punctuation added automatically
- Medical terminology recognized (Deepgram)
- Speaker diarization (if multiple speakers)

---

### Step 7: Save Answer and Move to Next Question

**Process:**
1. Patient finishes answering (text or voice)
2. Clicks "Next" button
3. System validates:
   - If mandatory → must have answer
   - If optional → can skip
4. Answer is temporarily stored in React state
5. Moves to next question
6. Textarea loads previous answer if going back

**State Management:**
```typescript
questionResponses = {
  "full_name": {
    answer: "John Smith",
    answerType: "text" | "voice" | "audio",
    questionId: 1,
    question: "Please state your full name.",
    audioUrl: "optional_audio_url"
  },
  ...
}
```

---

### Step 8: Complete Form Submission

**Final Submission Process:**

1. **Validation:**
   - Check all mandatory questions answered
   - Show error if any missing
   - List missing question numbers

2. **Submit Responses:**
   ```
   For each question:
     POST /api/public/intake-form/:formId/responses
     {
       questionId: string,
       question: string,
       answer: string,
       answerType: "text" | "voice" | "audio",
       audioUrl: string (optional)
     }
   ```

3. **Mark Form Complete:**
   ```
   POST /api/public/intake-form/:formId/complete
   ```
   - Updates form status to "completed"
   - Sets completedAt timestamp
   - Returns success

4. **Success Screen:**
   - Shows checkmark icon
   - "Form Completed" message
   - Thank you note
   - "You may close this window" instruction

---

## Database Schema

### intake_forms Table
```sql
CREATE TABLE intake_forms (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  unique_link TEXT UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

### intake_form_responses Table
```sql
CREATE TABLE intake_form_responses (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES intake_forms(id),
  question_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  answer_type TEXT DEFAULT 'text',
  audio_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints Summary

### Doctor/Admin Endpoints (Authenticated)
```
GET    /api/intake-forms              - List all forms
POST   /api/intake-forms              - Create new form
GET    /api/intake-forms/:id          - Get form details
DELETE /api/intake-forms/:id          - Delete form
GET    /api/intake-forms/:id/responses - Get form responses
```

### Patient/Public Endpoints (No Auth)
```
GET    /api/public/intake-form/:uniqueLink           - Get form by link
POST   /api/public/intake-form/:formId/responses     - Submit answer
POST   /api/public/intake-form/:formId/complete      - Mark complete
```

### AI/Transcription Endpoints
```
POST   /api/ai/transcribe              - Transcribe audio file
POST   /api/ai/generate-intake-summary - Generate AI summary from responses
```

---

## Question List (30 Questions)

### Mandatory Questions (5)
1. Full name
2. Date of birth
3. Gender
4. Email address
5. Phone number
6. Emergency contact

### Optional Questions (25)
Demographics, Insurance, Medical History, Current Symptoms, Lifestyle, Review of Systems

---

## Technical Implementation Details

### Voice Recording
- **Browser API:** MediaRecorder
- **Format:** WebM (audio/webm)
- **Permission:** Requires microphone access
- **Chunks:** Stored in memory until stop
- **Max Duration:** No limit (patient controlled)

### Live Transcription (Optional Feature)
- **API:** Web Speech API (SpeechRecognition)
- **Support:** Chrome, Edge (not Safari/Firefox)
- **Mode:** Continuous with interim results
- **Language:** en-US
- **Restart:** Auto-restarts if connection drops

### Audio Visualization (Optional)
- **Waveform:** AudioContext API
- **Level Meter:** ScriptProcessorNode or AudioWorklet
- **Visual Feedback:** Shows mic is working

---

## Error Handling

### Common Errors and Solutions

1. **Microphone Permission Denied**
   - Show clear error message
   - Instructions to enable permissions
   - Fallback to text input

2. **Transcription Failed**
   - Retry mechanism
   - Show error with retry button
   - Allow text input as backup

3. **Network Error During Submission**
   - Answers stored in state (not lost)
   - Retry submission
   - Show clear error message

4. **Form Expired**
   - Show expiration message
   - Contact information for help
   - Cannot submit (graceful error)

5. **Invalid or Missing Link**
   - 404 style error
   - "Form not found" message
   - Contact provider instructions

---

## Current Implementation Issues

### Missing Components in patient-join.tsx

The file references these undefined components/variables:
- `Radio` icon (not imported)
- `formatDuration` function
- `recordingDuration` state
- `AudioWaveform` component
- `audioLevel` state
- `hasAudioInput` state
- `Volume2`, `VolumeX`, `Activity`, `AlertCircle` icons
- `liveTranscript` state
- `recordingError` state
- `RecordingTroubleshoot` component

### Required Fixes

1. Import missing Lucide icons
2. Add recording duration timer
3. Add audio level detection
4. Create AudioWaveform component
5. Add live transcript state
6. Add error handling UI
7. Create troubleshooting component

---

## Recommended Improvements

### Priority 1 (Critical)
1. Fix missing imports and components
2. Test voice recording end-to-end
3. Verify transcription works with Deepgram
4. Test form submission flow

### Priority 2 (Important)
1. Add audio visualization
2. Implement live transcription fallback
3. Add better error messages
4. Test on mobile browsers

### Priority 3 (Nice to have)
1. Add question categories/sections
2. Save progress (draft mode)
3. Email notifications to doctor
4. PDF export of responses
5. AI summary generation

---

## Testing Checklist

- [ ] Create intake form (admin)
- [ ] Copy link successfully
- [ ] Patient opens link (public)
- [ ] Text input works for all questions
- [ ] Voice recording starts
- [ ] Microphone permission requested
- [ ] Recording indicator shows
- [ ] Stop recording works
- [ ] Transcript appears in textarea
- [ ] Can edit transcript
- [ ] Navigation (prev/next) works
- [ ] Question grid navigation works
- [ ] Mandatory validation works
- [ ] Form submission succeeds
- [ ] Success screen shows
- [ ] Doctor sees responses
- [ ] Test on mobile device
- [ ] Test on different browsers

---

## Environment Variables Required

```bash
# For transcription
DEEPGRAM_API_KEY=your_deepgram_api_key  # Preferred
OPENAI_API_KEY=your_openai_api_key      # Fallback

# Database
DATABASE_URL=postgresql://...           # Neon PostgreSQL

# For API access
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
```

---

## Browser Compatibility

### Desktop
- ✅ Chrome/Edge: Full support (including live transcription)
- ⚠️  Firefox: Voice recording only (no live transcription)
- ⚠️  Safari: Voice recording only (no live transcription)

### Mobile
- ✅ Chrome Android: Full support
- ⚠️  Safari iOS: Voice recording only
- ⚠️  Firefox Mobile: Voice recording only

### Fallback Strategy
- If Web Speech API unavailable → Post-recording transcription
- If MediaRecorder unavailable → Text input only
- If transcription fails → Manual text entry

---

## Performance Considerations

### Audio File Size
- WebM compression: ~30KB per minute
- 5-minute answer: ~150KB
- 30 questions × 5 min avg: ~4.5MB total

### Transcription Speed
- Deepgram: Near real-time (~1-2 seconds)
- OpenAI Whisper: 5-10 seconds for 1-minute audio
- Network latency: Depends on connection

### Database Storage
- Responses stored as text (transcripts)
- Audio URLs optional (if saving recordings)
- Typical form: ~50KB in database

---

## Security Considerations

1. **Public Access:**
   - Unique links are unguessable (timestamp + random)
   - No authentication required (by design)
   - Links can expire (optional)

2. **Data Protection:**
   - HTTPS required (protect in transit)
   - Database encrypted at rest (Neon)
   - Audio not stored unless specified

3. **Privacy:**
   - Patient data only accessible to assigned doctor
   - Responses linked to patient record
   - HIPAA compliance considerations

---

## Future Enhancements

1. **Multi-language Support**
   - Spanish, French, etc.
   - Automatic language detection
   - Translated questions

2. **Smart Question Routing**
   - Skip irrelevant questions based on answers
   - Conditional logic
   - Dynamic question generation

3. **AI-Powered Features**
   - Auto-summarize long answers
   - Extract key medical information
   - Flag urgent responses
   - Generate ICD-10 codes

4. **Enhanced Audio**
   - Noise cancellation
   - Audio quality check
   - Multiple file format support
   - Audio playback for review

5. **Offline Support**
   - Progressive Web App (PWA)
   - Save progress locally
   - Sync when online
   - Service worker caching

---

## Support and Troubleshooting

### For Patients
- Clear instructions on form page
- Help button with FAQ
- Contact information visible
- Alternative: Phone intake option

### For Doctors/Admins
- Activity log (who completed what)
- Email notifications (optional)
- Export responses to PDF/Excel
- Integration with EHR system

---

## Conclusion

The Patient Intake Voice Form system provides a modern, accessible way for patients to complete intake forms using voice or text input. The workflow is designed to be simple and intuitive while leveraging AI transcription for enhanced efficiency.

**Current Status:** 
- ✅ Core functionality implemented
- ⚠️  Voice recording UI needs fixes (missing components)
- ⚠️  Testing required on production
- 📋 Documentation complete
