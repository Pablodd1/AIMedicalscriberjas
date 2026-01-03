import { apiRequest, queryClient } from "./queryClient";
import { toast } from "@/hooks/use-toast";
import { InsertConsultationNote, InsertMedicalNote } from "@shared/schema";

// Simple notification function using toast
function notify(message: string, type: 'success' | 'error' = 'success') {
  console.log(`[${type.toUpperCase()}]: ${message}`);

  if (type === 'error') {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  } else {
    toast({
      title: "Success",
      description: message,
    });
  }

  return message;
}

// Define interface for recording service
interface RecordingServiceInterface {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  getTranscript: () => Promise<string>;
  processAudioFile: (file: File) => Promise<string>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isPaused: boolean;
  getLiveTranscript: () => string;
  getAudioUrl: () => string;
  getAudioLevel: () => number;
}

class BrowserRecordingService implements RecordingServiceInterface {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private _isRecording: boolean = false;
  private transcriptText: string = "";
  // Live transcription properties
  private speechRecognition: any = null;
  private _isLiveTranscribing: boolean = false;
  private liveTranscriptText: string = "";
  private onTranscriptCallback: ((text: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private _isPaused: boolean = false;
  private audioUrl: string = "";
  private stream: MediaStream | null = null;
  // Audio analysis
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  constructor() { }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get isLiveTranscribing(): boolean {
    return this._isLiveTranscribing;
  }

  getLiveTranscript(): string {
    return this.liveTranscriptText;
  }

  getAudioUrl(): string {
    return this.audioUrl;
  }

  getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    
    // Normalize to 0-100 range (approximate)
    // 255 is max byte value
    return Math.min(100, (average / 128) * 100);
  }

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      // Set up audio analysis
      try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          const source = this.audioContext.createMediaStreamSource(this.stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          source.connect(this.analyser);
          this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
      } catch (e) {
        console.error("Failed to setup audio analysis:", e);
      }

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });

      this.mediaRecorder.start(1000); // Collect data every second for safety
      this._isRecording = true;
      this._isPaused = false;

      // Prevent browser from stopping media when tab is hidden
      if ('setSinkId' in AudioContext.prototype || (window as any).chrome) {
        console.log("Persistence hint: Recording in background supported");
      }

      notify("Recording started. Speak clearly into your microphone");
    } catch (error) {
      console.error("Error starting recording:", error);
      notify("Could not start recording. Please check microphone permissions.", "error");
      throw error;
    }
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this._isPaused = true;
      if (this.speechRecognition && this._isLiveTranscribing) {
        this.speechRecognition.stop();
      }
      notify("Recording paused. It will continue when you resume.");
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this._isPaused = false;
      if (this.speechRecognition && this._isLiveTranscribing) {
        try {
          this.speechRecognition.start();
        } catch (e) {
          console.error("Failed to resume speech recognition", e);
        }
      }
      notify("Recording resumed.");
    }
  }

  async startLiveTranscription(onTranscript: (text: string) => void, onError?: (error: string) => void, language: string = 'en-US'): Promise<void> {
    try {
      // Check for speech recognition support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        const errorMsg = "Live transcription not supported in this browser. Recording will continue and transcription will happen after recording stops.";
        if (onError) onError(errorMsg);
        notify(errorMsg, "error");
        throw new Error(errorMsg);
      }

      // Store callbacks
      this.onTranscriptCallback = onTranscript;
      this.onErrorCallback = onError || null;

      // Initialize speech recognition
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = language; // Support multi-language

      // Handle results
      this.speechRecognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Update live transcript with final results
        if (finalTranscript) {
          this.liveTranscriptText += finalTranscript;
        }

        // Call callback with current transcript (final + interim)
        const currentTranscript = this.liveTranscriptText + interimTranscript;
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(currentTranscript);
        }
      };

      // Handle errors
      this.speechRecognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        let errorMsg = "";
        let shouldNotify = true;

        switch (event.error) {
          case 'not-allowed':
            errorMsg = "Microphone access denied. Please allow microphone access and try again.";
            break;
          case 'network':
            // Network errors are common and usually recoverable - don't spam user
            errorMsg = "network";
            shouldNotify = false; // Don't show notification for network errors
            console.log("Network error in speech recognition - this is normal, will retry automatically");
            break;
          case 'no-speech':
            // No speech detected - don't show error, just log
            console.log("No speech detected - waiting for speech...");
            shouldNotify = false;
            return; // Don't call error callback
          case 'audio-capture':
            errorMsg = "No microphone detected. Please connect a microphone and try again.";
            break;
          case 'aborted':
            // User or system aborted - don't show error
            shouldNotify = false;
            return;
          default:
            errorMsg = "Speech recognition error: " + event.error;
        }

        if (this.onErrorCallback && errorMsg) {
          this.onErrorCallback(errorMsg);
        }

        if (shouldNotify && errorMsg) {
          notify(errorMsg, "error");
        }
      };

      // Handle end event
      this.speechRecognition.onend = () => {
        if (this._isLiveTranscribing && !this._isPaused) {
          // Restart recognition if it stopped unexpectedly
          try {
            this.speechRecognition.start();
          } catch (error) {
            console.log("Speech recognition restart failed:", error);
          }
        }
      };

      // Start recognition
      this.speechRecognition.start();
      this._isLiveTranscribing = true;
      this.liveTranscriptText = "";

      notify("Live transcription started. Begin speaking...");
    } catch (error) {
      console.error("Error starting live transcription:", error);
      const errorMsg = "Could not start live transcription. " + (error instanceof Error ? error.message : "Unknown error");
      if (onError) onError(errorMsg);
      notify(errorMsg, "error");
      throw error;
    }
  }

  stopLiveTranscription(): void {
    if (this.speechRecognition) {
      this._isLiveTranscribing = false;
      this.speechRecognition.stop();
      this.speechRecognition = null;
      notify("Live transcription stopped");
    }

    // Clear callbacks
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
  }

  async stopRecording(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }

      this.mediaRecorder.addEventListener('stop', async () => {
        try {
          // Convert audio chunks to a single blob
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

          // Create audio URL for playback/storage
          this.audioUrl = URL.createObjectURL(audioBlob);

          // Transcribe the audio
          this.transcriptText = await this.transcribeAudio(audioBlob);

          // Stop all tracks in the stream
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }

          // Cleanup audio context
          if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.analyser = null;
            this.dataArray = null;
          }

          this._isRecording = false;
          this._isPaused = false;
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.mediaRecorder.stop();
    });
  }

  async getTranscript(): Promise<string> {
    return this.transcriptText;
  }

  async processAudioFile(file: File): Promise<string> {
    try {
      // Check if the file is an audio file
      if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        throw new Error("File must be an audio or video file");
      }

      // Transcribe the uploaded audio file
      this.transcriptText = await this.transcribeAudio(file);
      return this.transcriptText;
    } catch (error) {
      console.error("Error processing audio file:", error);
      notify("Failed to process audio file", "error");
      throw error;
    }
  }

  private async transcribeAudio(audioBlob: Blob | File): Promise<string> {
    try {
      // Create a File from the Blob with appropriate metadata if it's not already a File
      const file = audioBlob instanceof File ? audioBlob : new File([audioBlob], "recording.webm", { type: audioBlob.type });

      // Convert to form data for API
      const formData = new FormData();
      formData.append("audio", file);

      // Call our backend API to transcribe
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const data = await response.json();
      return data.transcript;
    } catch (error) {
      console.error("Transcription error:", error);
      notify("Failed to convert speech to text", "error");
      throw error;
    }
  }
}

// Generate SOAP notes from transcript using AI
export async function generateSoapNotes(
  transcript: string,
  patientInfo: any,
  noteType?: string,
  inputSource?: 'voice' | 'text' | 'upload' | 'telemedicine'
): Promise<string> {
  try {
    // Determine location/input method for the note
    const location = inputSource === 'telemedicine' ? 'Telemedicine/Video Consultation'
      : inputSource === 'voice' ? 'In-Office Voice Recording'
        : inputSource === 'upload' ? 'Audio File Upload (Pre-recorded)'
          : inputSource === 'text' ? 'Manual Transcript Entry'
            : 'Office Visit'; // Default for unknown

    // Simple direct implementation that should work reliably
    const response = await fetch('/api/ai/generate-soap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: transcript.substring(0, 4000), // limit to 4000 chars
        noteType: noteType || 'initial', // Pass note type to use custom prompts
        patientInfo: {
          id: patientInfo?.id || 0,
          name: `${patientInfo?.firstName || ''} ${patientInfo?.lastName || ''}`.trim() || 'Unknown',
          visitType: patientInfo?.visitType || 'General Consultation',
          location: location, // Pass the determined location
          inputSource: inputSource || 'unknown'
        }
      }),
    });

    // Parse response as json
    const data = await response.json();

    // Return the soap notes or a fallback
    return data.soap || "No SOAP notes were generated. Please try again.";

  } catch (error) {
    console.error("Error generating SOAP notes:", error);
    notify("Failed to generate SOAP notes", "error");

    // Return a fallback message instead of throwing to prevent UI breaking
    return "There was an error generating SOAP notes. Please try again.";
  }
}

// Save a consultation note to the database
export async function saveConsultationNote(
  patientId: number,
  doctorId: number,
  transcript: string,
  recordingMethod: string,
  title: string
): Promise<any> {
  try {
    const response = await apiRequest("POST", "/api/consultation-notes", {
      patientId,
      doctorId,
      transcript,
      recordingMethod,
      title
    });

    if (!response.ok) {
      throw new Error('Failed to save consultation note');
    }

    const data = await response.json();

    // Invalidate any related queries
    queryClient.invalidateQueries({ queryKey: ['/api/consultation-notes'] });
    queryClient.invalidateQueries({ queryKey: ['/api/consultation-notes', patientId] });

    return data;
  } catch (error) {
    console.error("Error saving consultation note:", error);
    notify("Failed to save consultation note", "error");
    throw error;
  }
}

// Create a medical note from consultation
export async function createMedicalNoteFromConsultation(
  consultationId: number,
  patientId: number,
  doctorId: number,
  content: string,
  type: 'soap' | 'progress' | 'procedure' | 'consultation',
  title: string
): Promise<any> {
  try {
    const response = await apiRequest("POST", "/api/medical-notes/from-consultation", {
      consultationId,
      patientId,
      doctorId,
      content,
      type,
      title
    });

    if (!response.ok) {
      throw new Error('Failed to create medical note from consultation');
    }

    const data = await response.json();

    // Invalidate any related queries
    queryClient.invalidateQueries({ queryKey: ['/api/medical-notes'] });
    queryClient.invalidateQueries({ queryKey: ['/api/medical-notes', patientId] });

    return data;
  } catch (error) {
    console.error("Error creating medical note from consultation:", error);
    notify("Failed to create medical note from consultation", "error");
    throw error;
  }
}

// Export singleton instance of recording service
export const recordingService = new BrowserRecordingService();