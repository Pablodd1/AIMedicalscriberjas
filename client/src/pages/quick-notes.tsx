import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, 
  FileText, 
  Save, 
  Stethoscope,
  ClipboardList,
  MessageSquare,
  Settings,
  Eye,
  Download,
  UserPlus,
  Users,
  Check,
  ChevronsUpDown,
  Calendar,
  Phone,
  Mail,
  MapPin,
  History,
  FileCheck,
  Activity,
  Sparkles,
  Video,
  Zap,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Patient, MedicalNote } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ConsultationModal } from "@/components/consultation-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SignaturePad, SignatureDisplay, SignatureData } from "@/components/signature-pad";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Note type configuration
const NOTE_TYPES = [
  { id: "initial", name: "Initial Consultation", icon: "🏥", description: "First visit with new patient" },
  { id: "followup", name: "Follow-Up Visit", icon: "🔄", description: "Progress check" },
  { id: "physical", name: "Physical Examination", icon: "📋", description: "Wellness exam" },
  { id: "reevaluation", name: "Re-Evaluation", icon: "🔍", description: "Treatment review" },
  { id: "procedure", name: "Procedure Note", icon: "🔧", description: "Medical procedure" },
  { id: "psychiatric", name: "Psychiatric Evaluation", icon: "🧠", description: "Mental health" },
  { id: "discharge", name: "Discharge Summary", icon: "📝", description: "Care discharge" },
];

export default function QuickNotes() {
  // Mode: 'quick' for no patient, 'patient' for with patient selection
  const [mode, setMode] = useState<'quick' | 'patient'>('quick');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteSuccess, setShowNoteSuccess] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNoteType, setSelectedNoteType] = useState<string>("initial");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch patients
  const { data: patients, isLoading: isLoadingPatients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Get selected patient details
  const selectedPatient = patients?.find(patient => patient.id === selectedPatientId);

  // Fetch patient's medical notes
  const { data: patientMedicalNotes } = useQuery<MedicalNote[]>({
    queryKey: ["/api/medical-notes", selectedPatientId],
    enabled: !!selectedPatientId && mode === 'patient',
  });

  // Fetch patient's intake forms
  const { data: patientIntakeForms } = useQuery<any[]>({
    queryKey: ["/api/intake-forms", selectedPatientId],
    enabled: !!selectedPatientId && mode === 'patient',
    queryFn: async () => {
      if (!selectedPatientId) return [];
      try {
        const res = await fetch(`/api/intake-forms?patientId=${selectedPatientId}`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }
  });

  // Generate default SOAP note structure
  useEffect(() => {
    if (!noteText) {
      setNoteText(
`SOAP Note

Subjective:
-
-
-

Objective:
-
-
-

Assessment:
-
-
-

Plan:
-
-
-
`);
    }
  }, []);

  // Generate AI suggestion for note type based on patient history
  useEffect(() => {
    if (mode === 'patient' && selectedPatient && patientMedicalNotes) {
      const hasNotes = patientMedicalNotes.length > 0;
      const lastNote = hasNotes ? patientMedicalNotes[0] : null;
      
      if (!hasNotes) {
        setAiSuggestion("New patient with no previous notes. Recommend: Initial Consultation");
        setSelectedNoteType("initial");
      } else if (lastNote) {
        const daysSinceLastNote = Math.floor((Date.now() - new Date(lastNote.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastNote > 365) {
          setAiSuggestion(`Last visit was ${daysSinceLastNote} days ago. Recommend: Annual Physical or Re-Evaluation`);
          setSelectedNoteType("physical");
        } else if (daysSinceLastNote > 30) {
          setAiSuggestion(`Last visit was ${daysSinceLastNote} days ago. Recommend: Follow-Up Visit`);
          setSelectedNoteType("followup");
        } else {
          setAiSuggestion(`Recent visit ${daysSinceLastNote} days ago. Recommend: Follow-Up or Procedure Note`);
          setSelectedNoteType("followup");
        }
      }
    } else {
      setAiSuggestion(null);
    }
  }, [mode, selectedPatient, patientMedicalNotes]);

  // Fetch note templates
  const { data: templates } = useQuery({
    queryKey: ["/api/note-templates", selectedNoteType],
    enabled: isSettingsOpen,
  });

  const selectedTemplate = templates?.find((t: any) => t.noteType === selectedNoteType);

  // Sync template content when note type changes or templates load
  useEffect(() => {
    if (selectedTemplate) {
      setSystemPrompt(selectedTemplate.systemPrompt || "");
      setTemplateContent(selectedTemplate.template || "");
    }
  }, [selectedNoteType, selectedTemplate]);

  // Calculate patient age
  const calculateAge = (dob: string | null | undefined) => {
    if (!dob) return "N/A";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  // Create quick note mutation (for notes without patient)
  const createQuickNoteMutation = useMutation({
    mutationFn: async (noteData: { title: string; content: string; doctorId: number; type: string }) => {
      const response = await apiRequest("POST", "/api/quick-notes", noteData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Quick note saved successfully",
      });
      setShowNoteSuccess(true);
      setTimeout(() => setShowNoteSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ["/api/quick-notes"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save note",
        variant: "destructive",
      });
    },
  });

  // Create medical note mutation (for notes with patient)
  const createMedicalNoteMutation = useMutation({
    mutationFn: async (noteData: { patientId: number; doctorId: number; content: string; type: string; title: string }) => {
      const res = await apiRequest("POST", "/api/medical-notes", noteData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-notes"] });
      toast({ title: "Success", description: "Medical note saved to patient record" });
      setShowNoteSuccess(true);
      setTimeout(() => setShowNoteSuccess(false), 3000);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Save custom prompt mutation
  const saveCustomPromptMutation = useMutation({
    mutationFn: async (data: { noteType: string; systemPrompt: string; templateContent: string }) => {
      const response = await apiRequest("POST", "/api/note-templates", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Custom prompt saved successfully",
      });
      setIsSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/note-templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save custom prompt",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNoteText("");
    setNoteTitle("");
    setSignatureData(null);
    setChatMessages([]);
  };

  const handleStartConsultation = () => {
    setShowConsultationModal(true);
  };

  const handleConsultationComplete = (transcript: string, notes: string) => {
    if (notes) {
      setNoteText(notes);
      const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : "Quick Note";
      setNoteTitle(`${patientName} - ${NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || 'Note'} ${format(new Date(), "MM/dd/yyyy")}`);
    }
    setShowConsultationModal(false);
  };

  // Handle chat with AI assistant
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsAssistantThinking(true);

    try {
      const patientContext = selectedPatient 
        ? `Patient: ${selectedPatient.firstName} ${selectedPatient.lastName || ''}, Age: ${calculateAge(selectedPatient.dateOfBirth)}.`
        : '';
      
      const messages = [
        {
          role: 'system',
          content: `You are an AI medical assistant helping a healthcare professional with documentation. ${patientContext} Provide accurate, evidence-based information. Keep responses concise and relevant to medical practice.`
        },
        ...chatMessages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage.content }
      ];

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      const data = await response.json();

      if (data.success && data.data?.content) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.data.content
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('No response from AI');
      }
    } catch (error) {
      console.error('Error calling AI API:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  const handleGenerateNotes = async () => {
    setIsGenerating(true);
    
    try {
      const transcript = noteText || `Quick note documentation. Please generate a structured medical note.`;

      const response = await fetch('/api/ai/generate-soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          noteType: selectedNoteType,
          patientInfo: selectedPatient || {
            firstName: "Quick",
            lastName: "Note",
            id: 0,
            dateOfBirth: format(new Date(), "yyyy-MM-dd"),
          }
        })
      });

      const data = await response.json();
      
      if (data.success && data.soap) {
        setNoteText(data.soap);
        const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : "Quick Note";
        setNoteTitle(`${patientName} - ${NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || selectedNoteType}`);
        toast({
          title: "Success",
          description: "Note generated successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.soap || "Failed to generate note",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error generating notes:', error);
      toast({
        title: "Error",
        description: "Failed to generate note",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) {
      toast({
        title: "Note Required",
        description: "Please enter note content before saving",
        variant: "destructive",
      });
      return;
    }

    if (!noteTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for the note",
        variant: "destructive",
      });
      return;
    }

    if (mode === 'patient' && selectedPatientId) {
      // Save as medical note linked to patient
      createMedicalNoteMutation.mutate({
        patientId: selectedPatientId,
        doctorId: user?.id || 1,
        content: noteText,
        type: "soap",
        title: noteTitle
      });
    } else {
      // Save as quick note (no patient)
      createQuickNoteMutation.mutate({
        doctorId: user?.id || 1,
        content: noteText,
        type: "soap",
        title: noteTitle
      });
    }
  };

  const handleDownloadNote = async () => {
    if (!noteText.trim() || !noteTitle.trim()) {
      toast({
        title: "Cannot Download",
        description: "Please enter note content and title before downloading",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDownloading(true);

      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      
      const docSections = [];
      
      // Title
      docSections.push(
        new Paragraph({
          text: noteTitle,
          heading: HeadingLevel.TITLE,
        })
      );
      
      // Note type and date info
      const noteTypeLabel = NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || 'Quick Note';
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${noteTypeLabel} • Generated ${new Date().toLocaleDateString('en-US')}`,
              italics: true,
              size: 20,
            }),
          ],
        })
      );
      
      docSections.push(new Paragraph({ text: "" })); // Empty line
      
      // Patient info if selected
      if (selectedPatient) {
        docSections.push(
          new Paragraph({
            text: "Patient Information",
            heading: HeadingLevel.HEADING_1,
          })
        );
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Name: ", bold: true }),
              new TextRun({ text: `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` }),
            ],
          })
        );
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Age: ", bold: true }),
              new TextRun({ text: `${calculateAge(selectedPatient.dateOfBirth)}` }),
            ],
          })
        );
        docSections.push(new Paragraph({ text: "" }));
      }
      
      // Note content
      docSections.push(
        new Paragraph({
          text: "Note Content",
          heading: HeadingLevel.HEADING_1,
        })
      );
      
      // Split content by lines and create paragraphs
      const contentLines = noteText.split('\n');
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
              text: `Generated: ${new Date().toLocaleString('en-US', { hour12: true })}`,
              italics: true,
              size: 18,
            }),
          ],
        })
      );
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: docSections,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${noteTitle.replace(/[^a-z0-9]/gi, '_')}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: "Note downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading note:', error);
      toast({
        title: "Download Failed",
        description: "Could not download the note",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Patient Summary Component
  const PatientSummary = () => {
    if (mode !== 'patient' || !selectedPatient) return null;

    return (
      <div className="space-y-4 mb-6">
        {/* Patient Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {selectedPatient.firstName[0]}{(selectedPatient.lastName || '')[0] || ''}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedPatient.firstName} {selectedPatient.lastName || ''}</h3>
                  <p className="text-sm text-muted-foreground">Age {calculateAge(selectedPatient.dateOfBirth)} • {selectedPatient.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                setSelectedPatientId(null);
                setAiSuggestion(null);
              }}>
                Change
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Suggestion */}
        {aiSuggestion && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">AI Suggestion</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{aiSuggestion}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Previous Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Previous Notes ({patientMedicalNotes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patientMedicalNotes && patientMedicalNotes.length > 0 ? (
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2">
                    {patientMedicalNotes.slice(0, 3).map((note) => (
                      <div key={note.id} className="p-2 bg-muted/50 rounded text-xs">
                        <div className="font-medium truncate">{note.title || 'Untitled'}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(note.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs text-center">
                  <div>
                    <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
                    <p>No previous notes</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Intake Forms */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Intake Forms ({patientIntakeForms?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patientIntakeForms && patientIntakeForms.length > 0 ? (
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2">
                    {patientIntakeForms.slice(0, 3).map((form: any) => (
                      <div key={form.id} className="p-2 bg-muted/50 rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Intake Form</span>
                          <Badge variant={form.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                            {form.status}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {format(new Date(form.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs text-center">
                  <div>
                    <ClipboardList className="h-6 w-6 mx-auto mb-1 opacity-50" />
                    <p>No intake forms</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Medical History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Medical History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[120px]">
                {selectedPatient?.medicalHistory ? (
                  <p className="text-xs whitespace-pre-wrap">{selectedPatient.medicalHistory}</p>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs text-center">
                    <div>
                      <Stethoscope className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      <p>No history recorded</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <ConsultationModal
        open={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
        onComplete={handleConsultationComplete}
        patientId={selectedPatientId}
        patientName={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : "Quick Note"}
      />

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Note Preview</DialogTitle>
            <DialogDescription className="text-sm">Preview your note before saving</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border rounded-md p-6 bg-background">
              <h2 className="text-2xl font-bold mb-4">{noteTitle || "Untitled Note"}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {new Date().toLocaleDateString('en-US')} • {NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || 'Quick Note'}
                {selectedPatient && ` • ${selectedPatient.firstName} ${selectedPatient.lastName || ''}`}
              </p>
              <Separator className="my-4" />
              <div className="prose max-w-none">
                {noteText.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 whitespace-pre-wrap">{line}</p>
                ))}
              </div>
              {signatureData && (
                <div className="mt-6 pt-4 border-t">
                  <SignatureDisplay signatureData={signatureData} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={showSignature} onOpenChange={setShowSignature}>
        <DialogContent className="w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Electronic Signature</DialogTitle>
            <DialogDescription>Sign to finalize this note</DialogDescription>
          </DialogHeader>
          {signatureData ? (
            <div className="space-y-4">
              <SignatureDisplay signatureData={signatureData} />
              <Button variant="outline" className="w-full" onClick={() => setSignatureData(null)}>
                Clear Signature
              </Button>
            </div>
          ) : (
            <SignaturePad
              documentTitle={noteTitle || "Medical Note"}
              documentType="medical_note"
              patientName={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : undefined}
              onSignatureComplete={(data) => {
                setSignatureData(data);
                setShowSignature(false);
                toast({ title: "Signature Captured", description: "Your electronic signature has been added." });
              }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignature(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Quick Notes</h1>
          <p className="text-sm md:text-base text-muted-foreground">Fast medical documentation with optional patient context</p>
        </div>
        <div className="flex gap-2 justify-end w-full sm:w-auto flex-wrap">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 md:h-10 md:w-10">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl">Note Settings</DialogTitle>
                <DialogDescription className="text-sm">
                  Configure templates and prompts for note generation
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="noteType">Note Type</Label>
                  <Select
                    value={selectedNoteType}
                    onValueChange={(value) => setSelectedNoteType(value)}
                  >
                    <SelectTrigger id="noteType">
                      <SelectValue placeholder="Select Note Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTE_TYPES.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.icon} {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    rows={4}
                    value={systemPrompt || (selectedTemplate?.systemPrompt || "")}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt for the AI..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="templateContent">Template Structure</Label>
                  <Textarea
                    id="templateContent"
                    rows={8}
                    value={templateContent || (selectedTemplate?.template || "")}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    placeholder="Enter the template structure for this note type..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => {
                    saveCustomPromptMutation.mutate({
                      noteType: selectedNoteType,
                      systemPrompt: systemPrompt || selectedTemplate?.systemPrompt || "",
                      templateContent: templateContent || selectedTemplate?.template || ""
                    });
                  }}
                  disabled={saveCustomPromptMutation.isPending}
                >
                  {saveCustomPromptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mode Toggle */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Zap className={cn("h-5 w-5", mode === 'quick' ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("font-medium", mode === 'quick' ? "text-primary" : "text-muted-foreground")}>Quick Mode</span>
              </div>
              <Switch
                checked={mode === 'patient'}
                onCheckedChange={(checked) => {
                  setMode(checked ? 'patient' : 'quick');
                  if (!checked) {
                    setSelectedPatientId(null);
                    setAiSuggestion(null);
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Users className={cn("h-5 w-5", mode === 'patient' ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("font-medium", mode === 'patient' ? "text-primary" : "text-muted-foreground")}>Patient Mode</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === 'quick' 
                ? "Create notes without patient selection" 
                : "Link notes to a patient with full context"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Patient Selection (only in patient mode) */}
      {mode === 'patient' && !selectedPatientId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Patient
            </CardTitle>
            <CardDescription>Choose a patient to view their history and create a linked note</CardDescription>
          </CardHeader>
          <CardContent>
            <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-12 text-lg">
                  Search and select a patient...
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name, email, or phone..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No patient found.</CommandEmpty>
                    <CommandGroup>
                      {isLoadingPatients ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading...
                        </div>
                      ) : patients?.map((patient) => (
                        <CommandItem
                          key={patient.id}
                          value={`${patient.firstName} ${patient.lastName || ''} ${patient.email} ${patient.phone || ''}`}
                          onSelect={() => {
                            setSelectedPatientId(patient.id);
                            setPatientSearchOpen(false);
                          }}
                          className="py-3"
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedPatientId === patient.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span className="font-medium">{patient.firstName} {patient.lastName || ''}</span>
                            <span className="text-sm text-muted-foreground">{patient.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      )}

      {/* Patient Summary (only shown when patient is selected) */}
      <PatientSummary />

      {/* Note Type Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Note Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {NOTE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedNoteType(type.id)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm transition-all hover:shadow-md flex items-center gap-2",
                  selectedNoteType === type.id 
                    ? "border-primary bg-primary/10 text-primary" 
                    : "border-muted hover:border-primary/50"
                )}
              >
                <span>{type.icon}</span>
                <span className="hidden sm:inline">{type.name}</span>
                <span className="sm:hidden">{type.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* SOAP Note Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl flex items-center justify-between">
              <span>{NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || 'SOAP Note'}</span>
              {mode === 'patient' && selectedPatient && (
                <Badge variant="secondary">
                  {selectedPatient.firstName} {selectedPatient.lastName || ''}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              {mode === 'patient' && selectedPatient 
                ? `Creating note for ${selectedPatient.firstName}` 
                : "Quick note without patient assignment"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="noteTitle" className="text-sm">Note Title</Label>
                <Input
                  id="noteTitle"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Enter note title"
                  className="mb-4"
                />
              </div>
              <Textarea
                placeholder="Start typing or use voice to record your notes..."
                className="min-h-[250px] md:min-h-[300px] text-sm md:text-base"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              
              {/* Action Buttons Row 1 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={handleStartConsultation}
                  className="w-full"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Voice</span>
                  <span className="sm:hidden">Voice</span>
                </Button>
                <Button 
                  onClick={handleGenerateNotes} 
                  disabled={isGenerating}
                  className="w-full"
                  variant="outline"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">AI Generate</span>
                      <span className="sm:hidden">AI</span>
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowSignature(true)}
                  className="w-full col-span-2 sm:col-span-1"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  {signatureData ? "Signed ✓" : "Sign"}
                </Button>
              </div>

              {/* Action Buttons Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  disabled={!noteText.trim() || !noteTitle.trim()}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleDownloadNote}
                  disabled={!noteText.trim() || !noteTitle.trim() || isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleSaveNote}
                  disabled={!noteText.trim() || !noteTitle.trim() || createQuickNoteMutation.isPending || createMedicalNoteMutation.isPending}
                >
                  {(createQuickNoteMutation.isPending || createMedicalNoteMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {mode === 'patient' && selectedPatientId ? "Save to Patient" : "Save Note"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Suggestions Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">AI Assistant</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="templates">
              <TabsList className="mb-4 grid grid-cols-3 w-full">
                <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
                <TabsTrigger value="analysis" className="text-xs sm:text-sm">
                  {mode === 'patient' ? 'Patient Info' : 'Tips'}
                </TabsTrigger>
                <TabsTrigger value="assistant" className="text-xs sm:text-sm">Chat</TabsTrigger>
              </TabsList>
              
              <TabsContent value="templates">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    Click a template to populate your note
                  </p>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => {
                      const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : "Patient";
                      setNoteTitle(`${patientName} - Initial Consultation`);
                      setNoteText(
`SOAP Note - Initial Consultation

Subjective:
- Chief complaint:
- History of present illness:
- Past medical history:
- Medications:
- Allergies:
- Social history:

Objective:
- Vital signs:
- General appearance:
- Physical examination findings:

Assessment:
- Primary diagnosis:
- Differential diagnoses:
- Clinical reasoning:

Plan:
- Diagnostics:
- Treatment:
- Patient education:
- Follow-up:
`);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">🏥</span>
                      <div>
                        <div className="font-medium">Initial Consultation</div>
                        <div className="text-xs text-muted-foreground">Complete SOAP for new patients</div>
                      </div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => {
                      const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : "Patient";
                      setNoteTitle(`${patientName} - Follow-up Visit`);
                      setNoteText(
`SOAP Note - Follow-up Visit

Subjective:
- Response to treatment:
- New or persistent symptoms:
- Medication compliance:
- Patient concerns:

Objective:
- Vital signs compared to last visit:
- Examination findings:
- Test results:

Assessment:
- Progress evaluation:
- Current status of diagnosis:
- New issues identified:

Plan:
- Medication adjustments:
- Additional testing:
- Referrals:
- Next appointment:
`);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">🔄</span>
                      <div>
                        <div className="font-medium">Follow-up Visit</div>
                        <div className="text-xs text-muted-foreground">Progress check template</div>
                      </div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => {
                      const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : "Patient";
                      setNoteTitle(`${patientName} - Physical Examination`);
                      setNoteText(
`SOAP Note - Physical Examination

Subjective:
- Presenting concerns:
- Health changes since last visit:
- Preventive care history:

Objective:
- Vital signs: BP, HR, RR, Temp, O2 Sat, Weight, Height, BMI
- HEENT:
- Cardiovascular:
- Respiratory:
- Gastrointestinal:
- Musculoskeletal:
- Neurological:
- Skin:

Assessment:
- General health status:
- Risk factors:
- Age-appropriate screening status:

Plan:
- Preventive recommendations:
- Screening tests:
- Lifestyle modifications:
- Immunization updates:
`);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">📋</span>
                      <div>
                        <div className="font-medium">Physical Examination</div>
                        <div className="text-xs text-muted-foreground">Annual wellness template</div>
                      </div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => {
                      const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : "Patient";
                      setNoteTitle(`${patientName} - Procedure Note`);
                      setNoteText(
`Procedure Note

Date: ${format(new Date(), "MM/dd/yyyy")}
${selectedPatient ? `Patient: ${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ''}

Procedure:
-

Indication:
-

Consent: Informed consent obtained

Pre-procedure Assessment:
- Vital signs:
- Relevant history:

Procedure Details:
- Anesthesia:
- Technique:
- Findings:
- Complications:

Post-procedure:
- Condition:
- Instructions given:
- Follow-up:
`);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">🔧</span>
                      <div>
                        <div className="font-medium">Procedure Note</div>
                        <div className="text-xs text-muted-foreground">Medical procedure documentation</div>
                      </div>
                    </div>
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="analysis">
                <div className="space-y-4">
                  {mode === 'patient' && selectedPatient ? (
                    <>
                      {/* Patient Details */}
                      <div className="border rounded-md p-3">
                        <p className="font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Patient Details
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Age: {calculateAge(selectedPatient.dateOfBirth)}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {selectedPatient.email}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {selectedPatient.phone || 'No phone'}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {selectedPatient.address || 'No address'}
                          </div>
                        </div>
                      </div>

                      {/* Visit Stats */}
                      <div className="border rounded-md p-3">
                        <p className="font-medium mb-2 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Visit Statistics
                        </p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>Total Notes: {patientMedicalNotes?.length || 0}</p>
                          <p>Intake Forms: {patientIntakeForms?.length || 0}</p>
                          {patientMedicalNotes && patientMedicalNotes.length > 0 && (
                            <p>Last Visit: {format(new Date(patientMedicalNotes[0].createdAt), 'MMM d, yyyy')}</p>
                          )}
                        </div>
                      </div>

                      {/* Telemedicine Option */}
                      <div className="border rounded-md p-3 bg-primary/5">
                        <p className="font-medium mb-2 flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Start Video Consultation
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          Need a video call? Start a telemedicine session with this patient.
                        </p>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => {
                          window.location.href = '/telemedicine';
                        }}>
                          <Video className="h-4 w-4 mr-2" />
                          Go to Telemedicine
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="border rounded-md p-3">
                        <p className="font-medium mb-2">Quick Notes Overview</p>
                        <p className="text-sm text-muted-foreground">
                          Quick notes allow fast documentation. Enable Patient Mode to link notes to a specific patient with full context.
                        </p>
                      </div>
                      <div className="border rounded-md p-3">
                        <p className="font-medium mb-2">Documentation Tips</p>
                        <p className="text-sm text-muted-foreground">
                          • Be specific and concise<br />
                          • Include relevant timestamps<br />
                          • Use standard medical terminology<br />
                          • Document objectively and factually
                        </p>
                      </div>
                      <div className="border rounded-md p-3 bg-primary/5">
                        <p className="font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Need Patient Context?
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          Enable Patient Mode to view history, intake forms, and AI suggestions.
                        </p>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => setMode('patient')}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Switch to Patient Mode
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="assistant">
                <div className="h-[400px] flex flex-col">
                  <div className="flex-1 border rounded-md mb-4 p-4 overflow-y-auto bg-secondary/5">
                    <div className="space-y-4">
                      <div className="flex justify-start">
                        <div className="bg-primary/10 rounded-lg p-3 max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1">
                            <Stethoscope className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">AI Assistant</span>
                          </div>
                          <p className="text-sm">
                            Hello! I'm your AI medical assistant. 
                            {selectedPatient && ` I see you're working on a note for ${selectedPatient.firstName}.`}
                            {' '}How can I help you today?
                          </p>
                        </div>
                      </div>
                      {chatMessages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-lg p-3 max-w-[85%] ${
                            message.role === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-primary/10'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              {message.role === 'assistant' && <Stethoscope className="h-4 w-4 text-primary" />}
                              <span className="font-medium text-sm">
                                {message.role === 'user' ? 'You' : 'AI Assistant'}
                              </span>
                              {message.role === 'user' && <UserPlus className="h-4 w-4" />}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      ))}
                      {isAssistantThinking && (
                        <div className="flex justify-start">
                          <div className="bg-primary/10 rounded-lg p-3 max-w-[85%]">
                            <div className="flex items-center gap-2 mb-1">
                              <Stethoscope className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">AI Assistant</span>
                            </div>
                            <p className="text-sm flex items-center">
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Thinking...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Ask a medical question or request help..." 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      disabled={isAssistantThinking}
                    />
                    <Button 
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim() || isAssistantThinking}
                    >
                      {isAssistantThinking ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
