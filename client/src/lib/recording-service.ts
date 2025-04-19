import { toast } from "@/hooks/use-toast";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, API calls should go through your backend
});

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
      
      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone"
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Could not start recording. Please check microphone permissions.",
        variant: "destructive" 
      });
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
      toast({
        title: "Processing Error",
        description: "Failed to process audio file",
        variant: "destructive"
      });
      throw error;
    }
  }
  
  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      // Create a File from the Blob with appropriate metadata
      const file = new File([audioBlob], "recording.webm", { type: audioBlob.type });
      
      // Convert to form data for API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-1");
      
      // Use OpenAI API to transcribe
      const response = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });
      
      return response.text;
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        title: "Transcription Error",
        description: "Failed to convert speech to text",
        variant: "destructive"
      });
      throw error;
    }
  }
}

// Generate SOAP notes from transcript using AI
export async function generateSoapNotes(transcript: string, patientInfo: any): Promise<string> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical documentation assistant. Create a detailed SOAP note from a clinical transcript.
          Format it properly with Subjective, Objective, Assessment, and Plan sections.
          Include all relevant medical information from the transcript.
          Be concise but thorough.
          Patient information: ${JSON.stringify(patientInfo)}`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    return response.choices[0].message.content || "Error generating notes";
  } catch (error) {
    console.error("Error generating SOAP notes:", error);
    toast({
      title: "Generation Error",
      description: "Failed to generate SOAP notes",
      variant: "destructive"
    });
    throw error;
  }
}

// Export singleton instance of recording service
export const recordingService = new BrowserRecordingService();