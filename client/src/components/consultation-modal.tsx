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
  Download,
} from "lucide-react";

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGeneratedNotes: (notes: string) => void;
  patientInfo: any;
  noteType?: string;
}

export function ConsultationModal({
  isOpen,
  onClose,
  onGeneratedNotes,
  patientInfo,
  noteType = 'initial',
}: ConsultationModalProps) {
  const [activeTab, setActiveTab] = useState("live-recording");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      setLiveTranscript("");
      
      // Start audio recording first
      await recordingService.startRecording();
      
      // Try to start live transcription with callbacks
      try {
        await recordingService.startLiveTranscription(
          (text: string) => {
            setLiveTranscript(text);
          },
          (error: string) => {
            console.error("Live transcription error:", error);
            // Don't show toast for errors during live transcription, just log them
          }
        );
        setIsLiveTranscribing(true);
      } catch (liveTranscriptionError) {
        // Live transcription failed, but continue with recording
        console.log("Live transcription not available, will use post-recording transcription:", liveTranscriptionError);
        setIsLiveTranscribing(false);
        // Show user-friendly message
        toast({
          title: "Live Transcription Unavailable",
          description: "Recording will continue normally. Transcription will happen after you stop recording.",
        });
      }
    } catch (error) {
      // If recording itself fails, clean up everything
      setIsRecording(false);
      setIsLiveTranscribing(false);
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording Failed",
        description: "Could not start recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      // Stop live transcription first if it's running
      if (isLiveTranscribing) {
        recordingService.stopLiveTranscription();
        setIsLiveTranscribing(false);
      }
      
      // Stop audio recording
      await recordingService.stopRecording();
      setIsRecording(false);
      
      // Try to get live transcript first, then fallback to backend transcription
      let finalTranscript = "";
      
      if (isLiveTranscribing || liveTranscript.trim()) {
        // Use live transcript if available
        finalTranscript = recordingService.getLiveTranscript() || liveTranscript;
        console.log("Using live transcript:", finalTranscript.length, "characters");
      }
      
      // Fallback to backend transcription if live transcript is empty or unavailable
      if (!finalTranscript.trim()) {
        console.log("Live transcript empty, falling back to backend transcription");
        try {
          finalTranscript = await recordingService.getTranscript();
          console.log("Backend transcript:", finalTranscript.length, "characters");
        } catch (backendError) {
          console.error("Backend transcription also failed:", backendError);
          toast({
            title: "Transcription Failed",
            description: "Could not transcribe the recording. Please try again or use text input.",
            variant: "destructive",
          });
          return;
        }
      }
      
      setTranscript(finalTranscript);
      
      // Generate notes from the final transcript
      if (finalTranscript.trim()) {
        generateNotes(finalTranscript);
      } else {
        toast({
          title: "No Transcript Available",
          description: "No speech was detected. Please try recording again or use text input.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
      setIsLiveTranscribing(false);
      toast({
        title: "Recording Error",
        description: "An error occurred while stopping the recording. Please try again.",
        variant: "destructive",
      });
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
      
      // Generate the notes using custom prompts for the selected note type
      const generatedNotes = await generateSoapNotes(text, patientInfo, noteType);
      
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

  // Handle downloading notes as Word document
  const handleDownloadNotes = async () => {
    if (!notes) return;

    try {
      setIsDownloading(true);

      // Create temporary note data for download
      const noteData = {
        content: notes,
        title: `SOAP Note - ${new Date().toLocaleDateString()}`,
        type: 'soap',
        patientId: patientInfo?.id,
        createdAt: new Date().toISOString()
      };

      // Generate Word document using the docx library
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      
      const docSections = [];
      
      // Title
      docSections.push(
        new Paragraph({
          text: noteData.title,
          heading: HeadingLevel.TITLE,
        })
      );
      
      // Note type and date info
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${noteData.type.toUpperCase()} Note • Generated ${new Date().toLocaleDateString()}`,
              italics: true,
              size: 20,
            }),
          ],
        })
      );
      
      docSections.push(new Paragraph({ text: "" })); // Empty line
      
      // Patient information if available
      if (patientInfo) {
        docSections.push(
          new Paragraph({
            text: "Patient Information",
            heading: HeadingLevel.HEADING_1,
          })
        );
        
        const patientName = `${patientInfo.firstName || ''} ${patientInfo.lastName || ''}`.trim();
        if (patientName) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Name: ", bold: true }),
                new TextRun({ text: patientName }),
              ],
            })
          );
        }
        
        docSections.push(new Paragraph({ text: "" })); // Empty line
      }
      
      // Note content
      docSections.push(
        new Paragraph({
          text: "Medical Note Content",
          heading: HeadingLevel.HEADING_1,
        })
      );
      
      // Split content by lines and create paragraphs
      const contentLines = notes.split('\n');
      contentLines.forEach(line => {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 24,
              }),
            ],
          })
        );
      });
      
      // Add timestamp
      docSections.push(new Paragraph({ text: "" })); // Empty line
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleString()}`,
              italics: true,
              size: 20,
            }),
          ],
        })
      );
      
      // Create the document
      const doc = new Document({
        sections: [{
          properties: {},
          children: docSections,
        }],
      });
      
      // Generate the DOCX buffer
      const docxBuffer = await Packer.toBuffer(doc);
      
      // Create download link
      const blob = new Blob([docxBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `soap-note-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Downloaded",
        description: "Notes downloaded as Word document",
      });
      
    } catch (error) {
      console.error("Failed to download notes:", error);
      toast({
        title: "Download Failed",
        description: "Failed to generate Word document",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
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
                {isLiveTranscribing && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-red-500 font-medium">Live transcription active</span>
                  </div>
                )}
              </div>
              
              {/* Live transcript display */}
              {isLiveTranscribing && liveTranscript && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">Live Transcript</h3>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <div className="p-4 border rounded-md bg-green-50 dark:bg-green-950/20 max-h-[150px] overflow-y-auto border-green-200 dark:border-green-800">
                    <p className="whitespace-pre-wrap text-sm">{liveTranscript}</p>
                  </div>
                </div>
              )}

              {transcript && !isRecording && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Final Transcript</h3>
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
                  <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950/20 max-h-[150px] overflow-y-auto border-blue-200 dark:border-blue-800">
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
                <div className="flex gap-2">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadNotes}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
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