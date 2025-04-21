import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  recordingService, 
  generateSoapNotes, 
  saveConsultationNote,
  createMedicalNoteFromConsultation 
} from "@/lib/recording-service";
import {
  Mic,
  StopCircle,
  Upload,
  FileText,
  Loader2,
  ClipboardCopy,
} from "lucide-react";

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGeneratedNotes: (notes: string) => void;
  patientInfo: any;
}

export function ConsultationModal({
  isOpen,
  onClose,
  onGeneratedNotes,
  patientInfo,
}: ConsultationModalProps) {
  const [activeTab, setActiveTab] = useState("live-recording");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      await recordingService.startRecording();
    } catch (error) {
      setIsRecording(false);
      console.error("Failed to start recording:", error);
    }
  };

  const handleStopRecording = async () => {
    try {
      await recordingService.stopRecording();
      setIsRecording(false);
      const text = await recordingService.getTranscript();
      setTranscript(text);
      generateNotes(text);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const text = await recordingService.processAudioFile(file);
      setTranscript(text);
      generateNotes(text);
    } catch (error) {
      console.error("Failed to process audio file:", error);
      toast({
        title: "Error",
        description: "Failed to process the audio file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateNotes = async (text: string) => {
    try {
      setIsProcessing(true);
      
      // Make sure we have sufficient text
      if (!text || text.trim().length < 10) {
        toast({
          title: "Not enough text",
          description: "Please provide more text to generate meaningful SOAP notes",
          variant: "destructive",
        });
        return;
      }
      
      // Ensure we have valid patient info
      if (!patientInfo || !patientInfo.id) {
        toast({
          title: "Patient information required",
          description: "Please select a patient before generating notes",
          variant: "destructive",
        });
        return;
      }
      
      // Generate the notes
      const generatedNotes = await generateSoapNotes(text, patientInfo);
      
      // Set the notes in the state
      setNotes(generatedNotes);
      
      // If generatedNotes contains an error message, show a toast
      if (generatedNotes.includes("error") || generatedNotes.includes("failed")) {
        toast({
          title: "Note generation limited",
          description: "The SOAP notes were generated with limited information. Please review and edit as needed.",
        });
      } else {
        toast({
          title: "Success",
          description: "SOAP notes generated successfully",
        });
      }
    } catch (error) {
      console.error("Failed to generate notes:", error);
      toast({
        title: "Error",
        description: "Failed to generate SOAP notes. Please try again with more detailed text.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [consultationId, setConsultationId] = useState<number | null>(null);

  // Save transcript to database
  const saveTranscriptToDatabase = async () => {
    if (!transcript || !patientInfo) return;

    try {
      setIsSaving(true);

      // Get the current recording method based on active tab
      const recordingMethod = activeTab;

      // Create a title for the consultation note based on patient info and timestamp
      const patientName = patientInfo.firstName 
        ? `${patientInfo.firstName} ${patientInfo.lastName || ''}`
        : patientInfo.name || 'Patient';
      const title = `Consultation with ${patientName} - ${new Date().toLocaleString()}`;

      // Get the current logged in user from auth
      const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const doctorId = userData?.id || 1;
      
      // Save transcript to database as consultation note
      const savedNote = await saveConsultationNote(
        patientInfo.id,
        doctorId,
        transcript,
        recordingMethod,
        title
      );

      // Store the consultation ID for potential linking to medical notes
      setConsultationId(savedNote.id);

      toast({
        title: "Saved",
        description: "Consultation transcript saved to database",
      });

      return savedNote;
    } catch (error) {
      console.error("Failed to save transcript:", error);
      toast({
        title: "Error",
        description: "Failed to save consultation transcript",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle using the generated notes
  const handleUseNotes = async () => {
    if (!transcript || !notes) return;

    try {
      // First save the transcript if not already saved
      let consultId = consultationId;
      if (!consultId) {
        const savedConsultation = await saveTranscriptToDatabase();
        if (savedConsultation) {
          consultId = savedConsultation.id;
        }
      }

      // Create a title for the medical note
      const patientName = patientInfo.firstName 
        ? `${patientInfo.firstName} ${patientInfo.lastName || ''}`
        : patientInfo.name || 'Patient';
      const title = `SOAP Note for ${patientName} - ${new Date().toLocaleString()}`;

      // Get the current logged in user (if not already fetched)
      const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const doctorId = userData?.id || 1;
      
      // If we have a consultation ID, create a medical note linked to it
      if (consultId) {
        await createMedicalNoteFromConsultation(
          consultId,
          patientInfo.id,
          doctorId,
          notes,
          'soap',
          title
        );
      }

      // Call the callback to use the notes
      onGeneratedNotes(notes);
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error("Failed to use notes:", error);
      toast({
        title: "Error",
        description: "Failed to save medical note",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consultation Recording</DialogTitle>
          <DialogDescription>
            Record, upload, or paste a consultation to generate SOAP notes
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="live-recording">Live Recording</TabsTrigger>
              <TabsTrigger value="upload-recording">Upload Recording</TabsTrigger>
              <TabsTrigger value="text-paste">Text Paste</TabsTrigger>
            </TabsList>

            <TabsContent value="live-recording" className="space-y-4 mt-4">
              <div className="flex flex-col items-center justify-center p-4 border rounded-md">
                {isRecording ? (
                  <Button
                    variant="destructive"
                    size="lg"
                    className="w-32 h-32 rounded-full flex flex-col gap-2"
                    onClick={handleStopRecording}
                  >
                    <StopCircle className="h-8 w-8" />
                    <span>Stop Recording</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-32 h-32 rounded-full flex flex-col gap-2"
                    onClick={handleStartRecording}
                  >
                    <Mic className="h-8 w-8" />
                    <span>Start Recording</span>
                  </Button>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  {isRecording
                    ? "Recording in progress... Speak clearly"
                    : "Click to start recording the consultation"}
                </p>
              </div>

              {transcript && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Transcript</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveTranscriptToDatabase}
                      disabled={isSaving || !patientInfo}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Save Transcript
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-4 border rounded-md bg-muted/50 max-h-[150px] overflow-y-auto">
                    <p className="whitespace-pre-wrap">{transcript}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload-recording" className="space-y-4 mt-4">
              <div className="flex flex-col items-center justify-center p-4 border rounded-md">
                <input
                  type="file"
                  accept="audio/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="lg"
                  className="w-32 h-32 rounded-full flex flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8" />
                  )}
                  <span>{isProcessing ? "Processing..." : "Upload Audio"}</span>
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Upload an audio recording of the consultation
                </p>
              </div>

              {transcript && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Transcript</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveTranscriptToDatabase}
                      disabled={isSaving || !patientInfo}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Save Transcript
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-4 border rounded-md bg-muted/50 max-h-[150px] overflow-y-auto">
                    <p className="whitespace-pre-wrap">{transcript}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text-paste" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Paste Consultation Text</h3>
                  {transcript.trim() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveTranscriptToDatabase}
                      disabled={isSaving || !patientInfo}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Save Transcript
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Paste or type the consultation text here..."
                  className="min-h-[150px]"
                  onChange={handleTextInput}
                  value={transcript}
                />
                <Button
                  onClick={() => generateNotes(transcript)}
                  disabled={!transcript.trim() || isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate SOAP Notes
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {notes && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Generated SOAP Notes</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(notes);
                    toast({
                      title: "Copied",
                      description: "Notes copied to clipboard",
                    });
                  }}
                >
                  <ClipboardCopy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <div className="p-4 border rounded-md bg-muted/50 max-h-[200px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm">{notes}</pre>
              </div>
            </div>
          )}
          
          <DialogFooter className="mt-6 flex sm:justify-between justify-center flex-wrap gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleUseNotes} disabled={!notes}>
              Use These Notes
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}