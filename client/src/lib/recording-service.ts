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
  isRecording: boolean;
}

class BrowserRecordingService implements RecordingServiceInterface {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private _isRecording: boolean = false;
  private transcriptText: string = "";
  
  constructor() {}
  
  get isRecording(): boolean {
    return this._isRecording;
  }
  
  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });
      
      this.mediaRecorder.start();
      this._isRecording = true;
      
      notify("Recording started. Speak clearly into your microphone");
    } catch (error) {
      console.error("Error starting recording:", error);
      notify("Could not start recording. Please check microphone permissions.", "error");
      throw error;
    }
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
          
          // Transcribe the audio
          this.transcriptText = await this.transcribeAudio(audioBlob);
          
          // Stop all tracks in the stream
          this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
          
          this._isRecording = false;
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
      if (!file.type.startsWith('audio/')) {
        throw new Error("File must be an audio file");
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
  
  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      // Create a File from the Blob with appropriate metadata
      const file = new File([audioBlob], "recording.webm", { type: audioBlob.type });
      
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
export async function generateSoapNotes(transcript: string, patientInfo: any): Promise<string> {
  try {
    // Validate and prepare patient info to prevent JSON stringify issues
    const safePatientInfo = {
      id: patientInfo?.id || 0,
      firstName: patientInfo?.firstName || '',
      lastName: patientInfo?.lastName || '',
      gender: patientInfo?.gender || 'Unknown',
      dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
      // Add any other essential fields but keep it minimal
    };
    
    // Call our backend API to generate SOAP notes using apiRequest helper
    // to ensure consistent headers and authentication
    const response = await apiRequest('POST', '/api/ai/generate-soap', {
      transcript,
      patientInfo: safePatientInfo,
    });
    
    try {
      if (!response.ok) {
        console.error(`Server error: ${response.status} ${response.statusText}`);
        return "Server error occurred. Please try again later.";
      }
      
      const data = await response.json();
      
      if (data && data.soap) {
        return data.soap;
      } else {
        console.error("Invalid response format:", data);
        return "No SOAP notes were generated. Please try with more detailed text.";
      }
    } catch (responseError) {
      console.error("Response processing error:", responseError);
      return "There was an error processing the server response. Please try again with more detailed text.";
    }
  } catch (error) {
    console.error("Error generating SOAP notes:", error);
    notify("Failed to generate SOAP notes", "error");
    
    // Return a fallback message instead of throwing to prevent UI breaking
    return "There was an error generating SOAP notes. Please try again with more detailed transcript text.";
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