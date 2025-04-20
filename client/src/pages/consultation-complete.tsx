import { useState, useEffect } from "react";
import { CheckCircle, FileAudio, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";

interface RecordingSession {
  id: number;
  roomId: string;
  audioFilePath: string;
  transcription: string;
  notes: string;
}

export default function ConsultationCompletePage() {
  const [isDoctor, setIsDoctor] = useState(false);
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [notes, setNotes] = useState('');
  
  // Get room ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('roomId');
  
  useEffect(() => {
    // Check if the user is a doctor
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const userData = await response.json();
          setIsDoctor(userData.role === 'doctor' || userData.role === 'admin');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      }
    };
    
    // Get existing recording session for this room
    const getRecordingSession = async () => {
      if (!roomId) return;
      
      try {
        const response = await fetch(`/api/telemedicine/recordings?roomId=${roomId}`);
        if (response.ok) {
          const recordings = await response.json();
          // Find the recording for this room
          const currentRecording = recordings.find((r: any) => r.roomId === roomId);
          if (currentRecording) {
            setRecordingSession(currentRecording);
            if (currentRecording.notes) {
              setNotes(currentRecording.notes);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching recording session:', error);
      }
    };
    
    checkAuth();
    if (roomId) {
      getRecordingSession();
    }
  }, [roomId]);
  
  const handleSaveRecording = async () => {
    if (!roomId) return;
    
    try {
      setIsSubmitting(true);
      
      // Start recording the audio from the stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunks.push(event.data);
      });
      
      mediaRecorder.addEventListener('stop', async () => {
        // Create a Blob from the recorded audio chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Create FormData to send the audio file
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('roomId', roomId);
        formData.append('notes', notes);
        formData.append('transcribe', enableTranscription ? 'true' : 'false');
        
        // Send recording to server
        const response = await fetch('/api/telemedicine/recordings', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          setRecordingSession(data);
          setShowSuccessDialog(true);
        } else {
          console.error('Failed to save recording:', await response.text());
        }
        
        setIsSubmitting(false);
        
        // Stop all tracks from the stream
        stream.getTracks().forEach((track) => track.stop());
      });
      
      // Start recording for 1 second just to create a placeholder file
      // In a real scenario you would have recorded during the consultation
      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 1000);
      
    } catch (error) {
      console.error('Error saving recording:', error);
      setIsSubmitting(false);
    }
  };
  
  const handleRequestTranscription = async () => {
    if (!recordingSession) return;
    
    try {
      setIsTranscribing(true);
      
      // Request transcription from the server
      const response = await apiRequest('PATCH', `/api/telemedicine/recordings/${recordingSession.id}`, {
        requestTranscription: true
      });
      
      if (response.ok) {
        const updatedSession = await response.json();
        setRecordingSession(updatedSession);
      }
    } catch (error) {
      console.error('Error requesting transcription:', error);
    } finally {
      setIsTranscribing(false);
    }
  };
  
  const handleDownloadRecording = () => {
    if (!recordingSession || !recordingSession.audioFilePath) return;
    
    // Create a link to download the recording
    const downloadLink = document.createElement('a');
    downloadLink.href = `/api/telemedicine/recordings/${recordingSession.id}/download`;
    downloadLink.download = `consultation_recording_${recordingSession.id}.mp3`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };
  
  return (
    <div className="container flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">Consultation Complete</CardTitle>
          <CardDescription>
            Thank you for participating in the telemedicine consultation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p>
              Your virtual consultation has ended successfully. Your doctor will follow up with 
              any additional information, prescriptions, or next steps as discussed in your session.
            </p>
            {isDoctor && !recordingSession && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <h3 className="font-medium">Save Consultation Recording</h3>
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="transcription" 
                    checked={enableTranscription}
                    onCheckedChange={(checked) => setEnableTranscription(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="transcription">Enable automatic transcription</Label>
                    <p className="text-sm text-muted-foreground">
                      Uses AI to automatically transcribe the audio
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Consultation Notes</Label>
                  <Textarea 
                    id="notes" 
                    placeholder="Enter any notes about this consultation" 
                    className="min-h-[100px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleSaveRecording}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileAudio className="mr-2 h-4 w-4" />
                      Save Recording
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {recordingSession && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <h3 className="font-medium">Consultation Recording</h3>
                
                {recordingSession.audioFilePath && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleDownloadRecording}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Recording
                  </Button>
                )}
                
                {recordingSession.transcription ? (
                  <div className="space-y-2 text-left">
                    <h4 className="font-medium text-sm">Transcription:</h4>
                    <div className="bg-background p-3 rounded-md text-sm">
                      {recordingSession.transcription}
                    </div>
                  </div>
                ) : isDoctor && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleRequestTranscription}
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Transcription
                      </>
                    )}
                  </Button>
                )}
                
                {recordingSession.notes && (
                  <div className="space-y-2 text-left">
                    <h4 className="font-medium text-sm">Notes:</h4>
                    <div className="bg-background p-3 rounded-md text-sm">
                      {recordingSession.notes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            className="w-full max-w-xs" 
            onClick={() => window.close()}
          >
            Close Window
          </Button>
        </CardFooter>
      </Card>
      
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recording Saved Successfully</AlertDialogTitle>
            <AlertDialogDescription>
              Your consultation recording has been saved. {enableTranscription && 'The audio is being transcribed and will be available shortly.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}