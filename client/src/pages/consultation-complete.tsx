import { useState, useEffect } from "react";
import { CheckCircle, FileAudio, FileText, Download, Loader2, Edit, Save, Copy } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RecordingSession {
  id: number;
  roomId: string;
  doctorId: number;
  patientId: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  audioFilePath: string;
  transcript?: string; // API endpoint returns transcript but we also use transcription for consistency
  transcription?: string;
  notes: string;
  patient?: {
    name: string;
    id: number;
  };
}

export default function ConsultationCompletePage() {
  const [isDoctor, setIsDoctor] = useState(false);
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [notes, setNotes] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const { toast } = useToast();
  
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
            
            // Set notes if available
            if (currentRecording.notes) {
              setNotes(currentRecording.notes);
            }
            
            // Set transcript if available (check both fields since we have inconsistent naming)
            if (currentRecording.transcript) {
              setTranscript(currentRecording.transcript);
            } else if (currentRecording.transcription) {
              setTranscript(currentRecording.transcription);
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
        
        // Update transcript state with the newly transcribed content
        if (updatedSession.transcript) {
          setTranscript(updatedSession.transcript);
        } else if (updatedSession.transcription) {
          setTranscript(updatedSession.transcription);
        }
        
        toast({
          title: "Transcription Complete",
          description: "The audio recording has been successfully transcribed.",
        });
      }
    } catch (error) {
      console.error('Error requesting transcription:', error);
      toast({
        title: "Transcription Failed",
        description: "There was an error transcribing the audio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };
  
  const handleSaveTranscript = async () => {
    if (!recordingSession) return;
    
    try {
      setIsSavingTranscript(true);
      
      // Save transcript to the server
      const response = await apiRequest('PATCH', `/api/telemedicine/recordings/${recordingSession.id}`, {
        transcript: transcript
      });
      
      if (response.ok) {
        const updatedSession = await response.json();
        setRecordingSession(updatedSession);
        setIsEditingTranscript(false);
        
        toast({
          title: "Transcript Saved",
          description: "The transcript has been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving the transcript. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTranscript(false);
    }
  };
  
  const handleSaveNotes = async () => {
    if (!recordingSession) return;
    
    try {
      setIsSavingNotes(true);
      
      // Save notes to the server
      const response = await apiRequest('PATCH', `/api/telemedicine/recordings/${recordingSession.id}`, {
        notes: notes
      });
      
      if (response.ok) {
        const updatedSession = await response.json();
        setRecordingSession(updatedSession);
        setIsEditingNotes(false);
        
        toast({
          title: "Notes Saved",
          description: "The consultation notes have been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving the notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotes(false);
    }
  };
  
  const handleCopyTranscript = () => {
    if (!transcript) return;
    
    navigator.clipboard.writeText(transcript)
      .then(() => {
        toast({
          title: "Copied to Clipboard",
          description: "The transcript has been copied to your clipboard.",
        });
      })
      .catch((error) => {
        console.error('Error copying to clipboard:', error);
        toast({
          title: "Copy Failed",
          description: "There was an error copying to clipboard. Please try again.",
          variant: "destructive",
        });
      });
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
                    Download Audio Recording
                  </Button>
                )}
                
                <Tabs defaultValue="transcription" className="w-full mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="transcription">Transcription</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="transcription" className="space-y-4 mt-4">
                    {(recordingSession.transcription || recordingSession.transcript) ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-sm">Transcription:</h4>
                          <div className="flex gap-2">
                            {isDoctor && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit Transcription</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={handleCopyTranscript}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copy to Clipboard</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        
                        {isEditingTranscript ? (
                          <div className="space-y-3">
                            <Textarea 
                              value={transcript} 
                              onChange={(e) => setTranscript(e.target.value)}
                              className="min-h-[200px]"
                            />
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setIsEditingTranscript(false)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                size="sm"
                                onClick={handleSaveTranscript}
                                disabled={isSavingTranscript}
                              >
                                {isSavingTranscript ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-3 w-3" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-background p-3 rounded-md text-sm whitespace-pre-wrap">
                            {transcript || recordingSession.transcription || recordingSession.transcript}
                          </div>
                        )}
                      </div>
                    ) : isDoctor ? (
                      <Button 
                        variant="default" 
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
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No transcription available yet.</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="notes" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-sm">Consultation Notes:</h4>
                        {isDoctor && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setIsEditingNotes(!isEditingNotes)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit Notes</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      
                      {isEditingNotes ? (
                        <div className="space-y-3">
                          <Textarea 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[200px]"
                            placeholder="Enter consultation notes here..."
                          />
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setIsEditingNotes(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleSaveNotes}
                              disabled={isSavingNotes}
                            >
                              {isSavingNotes ? (
                                <>
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 h-3 w-3" />
                                  Save Notes
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : notes ? (
                        <div className="bg-background p-3 rounded-md text-sm whitespace-pre-wrap">
                          {notes}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No notes have been added yet.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
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