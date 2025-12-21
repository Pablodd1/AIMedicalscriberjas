import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Mic, 
  Loader2, 
  FileText, 
  Save, 
  Users, 
  Check, 
  UserPlus,
  Stethoscope,
  ClipboardList,
  MessageSquare,
  Settings,
  ChevronsUpDown,
  Eye,
  Download,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  AlertCircle,
  Sparkles,
  History,
  FileCheck,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Activity
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
import { Patient, InsertMedicalNote, MedicalNote, MedicalNoteTemplate, InsertMedicalNoteTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ConsultationModal } from "@/components/consultation-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignaturePad, SignatureDisplay, SignatureData } from "@/components/signature-pad";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Note type configuration with specialty prompts
const NOTE_TYPES = [
  { id: "initial", name: "Initial Consultation", icon: "🏥", description: "First visit with new patient", specialty: "General" },
  { id: "followup", name: "Follow-Up Visit", icon: "🔄", description: "Progress check for existing patient", specialty: "General" },
  { id: "physical", name: "Physical Examination", icon: "📋", description: "Annual wellness exam", specialty: "Primary Care" },
  { id: "reevaluation", name: "Re-Evaluation", icon: "🔍", description: "Treatment review and adjustment", specialty: "General" },
  { id: "procedure", name: "Procedure Note", icon: "🔧", description: "Document medical procedure", specialty: "Procedural" },
  { id: "psychiatric", name: "Psychiatric Evaluation", icon: "🧠", description: "Mental health assessment", specialty: "Psychiatry" },
  { id: "discharge", name: "Discharge Summary", icon: "📝", description: "Hospital/care discharge", specialty: "Hospital" },
];

export default function Notes() {
  // Workflow state: 1=Select Patient, 2=Review Summary, 3=Consultation, 4=Review & Sign
  const [workflowStep, setWorkflowStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [showNoteSuccess, setShowNoteSuccess] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNoteType, setSelectedNoteType] = useState<string>("initial");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch patients
  const { data: patients, isLoading: isLoadingPatients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch note templates
  const { data: noteTemplates } = useQuery<MedicalNoteTemplate[]>({
    queryKey: ["/api/medical-note-templates"],
  });

  // Get selected patient details
  const selectedPatient = patients?.find(patient => patient.id === selectedPatientId);

  // Fetch patient's medical notes
  const { data: patientMedicalNotes } = useQuery<MedicalNote[]>({
    queryKey: ["/api/medical-notes", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  // Fetch patient's intake forms
  const { data: patientIntakeForms } = useQuery<any[]>({
    queryKey: ["/api/intake-forms", selectedPatientId],
    enabled: !!selectedPatientId,
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

  // Fetch patient's appointments
  const { data: patientAppointments } = useQuery<any[]>({
    queryKey: ["/api/appointments", selectedPatientId],
    enabled: !!selectedPatientId,
    queryFn: async () => {
      if (!selectedPatientId) return [];
      try {
        const res = await fetch(`/api/appointments?patientId=${selectedPatientId}`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }
  });

  // Load custom prompt when note type changes
  useEffect(() => {
    let isActive = true;
    (async () => {
      if (!selectedNoteType || !user?.id) return;
      try {
        const res = await fetch(`/api/custom-note-prompts/${selectedNoteType}`);
        if (!res.ok) throw new Error('Failed to fetch custom prompt');
        const prompt = await res.json();
        if (!isActive) return;
        if (prompt && prompt.id) {
          setSystemPrompt(prompt.systemPrompt || '');
          setTemplateContent(prompt.templateContent || '');
        }
      } catch (error) {
        console.error('Error loading custom prompt:', error);
      }
    })();
    return () => { isActive = false; };
  }, [selectedNoteType, user?.id]);

  // Generate AI suggestion for note type based on patient history
  useEffect(() => {
    if (selectedPatient && patientMedicalNotes && workflowStep === 2) {
      const hasNotes = patientMedicalNotes.length > 0;
      const lastNote = hasNotes ? patientMedicalNotes[0] : null;
      
      if (!hasNotes) {
        setAiSuggestion("This is a new patient with no previous notes. Recommend: Initial Consultation");
        setSelectedNoteType("initial");
      } else if (lastNote) {
        const daysSinceLastNote = Math.floor((Date.now() - new Date(lastNote.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastNote > 365) {
          setAiSuggestion(`Last visit was ${daysSinceLastNote} days ago. Recommend: Annual Physical or Re-Evaluation`);
        } else if (daysSinceLastNote > 30) {
          setAiSuggestion(`Last visit was ${daysSinceLastNote} days ago. Recommend: Follow-Up Visit`);
          setSelectedNoteType("followup");
        } else {
          setAiSuggestion(`Recent visit ${daysSinceLastNote} days ago. Recommend: Follow-Up Visit or Procedure Note`);
          setSelectedNoteType("followup");
        }
      }
    }
  }, [selectedPatient, patientMedicalNotes, workflowStep]);

  // Create medical note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: InsertMedicalNote) => {
      const res = await apiRequest("POST", "/api/medical-notes", noteData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-notes"] });
      setShowNoteSuccess(true);
      toast({ title: "Success", description: "Medical note saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Save custom prompt mutation
  const saveCustomPromptMutation = useMutation({
    mutationFn: async (data: { noteType: string; systemPrompt: string; templateContent: string }) => {
      const res = await apiRequest('POST', '/api/custom-note-prompts', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-note-prompts'] });
      toast({ title: "Success", description: "Custom prompt saved successfully" });
      setIsSettingsOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleGeneratedNotesFromConsultation = (notes: string) => {
    setNoteText(notes);
    setNoteTitle(`${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ""} - ${NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || 'Consultation'} ${format(new Date(), "yyyy-MM-dd")}`);
    setWorkflowStep(4); // Move to review step
  };

  const handleSaveNote = () => {
    if (!selectedPatientId || !noteText.trim() || !noteTitle.trim()) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createNoteMutation.mutate({
      patientId: selectedPatientId,
      doctorId: user?.id || 1,
      content: noteText,
      type: "soap",
      title: noteTitle
    });
  };

  const handleDownloadNote = async () => {
    if (!noteText.trim() || !noteTitle.trim()) return;
    try {
      setIsDownloading(true);
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const docSections = [];
      docSections.push(new Paragraph({ text: noteTitle, heading: HeadingLevel.TITLE }));
      docSections.push(new Paragraph({
        children: [new TextRun({ text: `${NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || 'SOAP Note'} • ${new Date().toLocaleDateString('en-US')}`, italics: true, size: 20 })]
      }));
      docSections.push(new Paragraph({ text: "" }));
      if (selectedPatient) {
        docSections.push(new Paragraph({ text: "Patient Information", heading: HeadingLevel.HEADING_1 }));
        docSections.push(new Paragraph({
          children: [
            new TextRun({ text: "Name: ", bold: true }),
            new TextRun({ text: `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` }),
          ]
        }));
        docSections.push(new Paragraph({ text: "" }));
      }
      docSections.push(new Paragraph({ text: "Medical Note Content", heading: HeadingLevel.HEADING_1 }));
      noteText.split('\n').forEach(line => {
        docSections.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })] }));
      });
      docSections.push(new Paragraph({ text: "" }));
      docSections.push(new Paragraph({
        children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, italics: true, size: 20 })]
      }));
      const doc = new Document({ sections: [{ properties: {}, children: docSections }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medical-note-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "Note downloaded as Word document" });
    } catch (error) {
      toast({ title: "Download Failed", description: "Failed to generate Word document", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  // Chat with AI assistant
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsAssistantThinking(true);
    try {
      const messages = [
        { role: 'system', content: 'You are an AI medical assistant helping a healthcare professional. Provide accurate, evidence-based information and always clarify that the doctor should use their professional judgment. Keep responses concise and relevant to medical practice.' },
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
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.data.content }]);
      } else {
        throw new Error('No response from AI');
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  const resetWorkflow = () => {
    setWorkflowStep(1);
    setSelectedPatientId(null);
    setNoteText("");
    setNoteTitle("");
    setSignatureData(null);
    setChatMessages([]);
    setShowNoteSuccess(false);
  };

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

  // Render workflow step indicator
  const WorkflowIndicator = () => (
    <div className="flex items-center justify-center mb-6 gap-2">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <button
            onClick={() => {
              if (step === 1) resetWorkflow();
              else if (step <= workflowStep) setWorkflowStep(step);
            }}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              workflowStep === step ? "bg-primary text-primary-foreground" :
              workflowStep > step ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
            )}
          >
            {workflowStep > step ? <Check className="h-5 w-5" /> : step}
          </button>
          {step < 4 && (
            <div className={cn("w-8 h-1 mx-1", workflowStep > step ? "bg-green-500" : "bg-muted")} />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Patient Selection
  const renderPatientSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Select Patient</h2>
        <p className="text-muted-foreground">Choose a patient to create a medical note</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Patient Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-12 text-lg">
                {selectedPatientId ? (
                  patients?.find((p) => p.id === selectedPatientId)
                    ? `${patients.find((p) => p.id === selectedPatientId)!.firstName} ${patients.find((p) => p.id === selectedPatientId)!.lastName || ''}`
                    : "Select Patient"
                ) : "Search and select a patient..."}
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

          {selectedPatientId && selectedPatient && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedPatient.firstName} {selectedPatient.lastName || ''}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          size="lg" 
          onClick={() => setWorkflowStep(2)} 
          disabled={!selectedPatientId}
          className="px-8"
        >
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Step 2: Patient Summary & Note Type Selection
  const renderPatientSummary = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">Pre-Consultation Summary</h2>
        <p className="text-muted-foreground">Review patient history and select consultation type</p>
      </div>

      {/* Patient Quick Info */}
      {selectedPatient && (
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
              <Button variant="ghost" size="sm" onClick={() => setWorkflowStep(1)}>
                Change Patient
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Previous Notes Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Previous Notes ({patientMedicalNotes?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patientMedicalNotes && patientMedicalNotes.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {patientMedicalNotes.slice(0, 5).map((note) => (
                    <div key={note.id} className="p-2 bg-muted/50 rounded text-sm">
                      <div className="font-medium truncate">{note.title || 'Untitled Note'}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(note.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No previous notes</p>
                  <p className="text-xs">This is a new patient</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intake Forms Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Intake Forms ({patientIntakeForms?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patientIntakeForms && patientIntakeForms.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {patientIntakeForms.map((form: any) => (
                    <div key={form.id} className="p-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Intake Form</span>
                        <Badge variant={form.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                          {form.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(form.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No intake forms</p>
                  <p className="text-xs">Send form from Patient Intake</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medical History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Medical History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {selectedPatient?.medicalHistory ? (
                <p className="text-sm whitespace-pre-wrap">{selectedPatient.medicalHistory}</p>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center">
                    <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No medical history</p>
                    <p className="text-xs">Add via patient profile</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

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

      {/* Note Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Consultation Type
          </CardTitle>
          <CardDescription>Choose the type of medical note to create</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {NOTE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedNoteType(type.id)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all hover:shadow-md",
                  selectedNoteType === type.id 
                    ? "border-primary bg-primary/5" 
                    : "border-muted hover:border-primary/50"
                )}
              >
                <div className="text-2xl mb-2">{type.icon}</div>
                <div className="font-medium text-sm">{type.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{type.description}</div>
                <Badge variant="outline" className="mt-2 text-xs">{type.specialty}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setWorkflowStep(1)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button size="lg" onClick={() => setWorkflowStep(3)} className="px-8">
          Start Consultation
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Step 3: Consultation (Recording/Input)
  const renderConsultation = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">{NOTE_TYPES.find(t => t.id === selectedNoteType)?.name || 'Consultation'}</h2>
        <p className="text-muted-foreground">
          {selectedPatient?.firstName} {selectedPatient?.lastName || ''} • {format(new Date(), 'MMMM d, yyyy')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Input Area */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Consultation Input
                </span>
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Prompt Settings</DialogTitle>
                      <DialogDescription>Customize prompts for {NOTE_TYPES.find(t => t.id === selectedNoteType)?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>System Prompt</Label>
                        <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} />
                      </div>
                      <div>
                        <Label>Template Content</Label>
                        <Textarea value={templateContent} onChange={(e) => setTemplateContent(e.target.value)} rows={6} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                      <Button onClick={() => saveCustomPromptMutation.mutate({ noteType: selectedNoteType, systemPrompt, templateContent })}>
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <Button 
                  onClick={() => setShowConsultationModal(true)}
                  className="h-24 flex flex-col gap-2"
                  variant="outline"
                >
                  <Mic className="h-8 w-8" />
                  <span>Voice Record</span>
                </Button>
                <Button 
                  onClick={() => {
                    setNoteText("");
                    setNoteTitle(`${selectedPatient?.firstName} ${selectedPatient?.lastName || ''} - ${NOTE_TYPES.find(t => t.id === selectedNoteType)?.name}`);
                  }}
                  className="h-24 flex flex-col gap-2"
                  variant="outline"
                >
                  <FileText className="h-8 w-8" />
                  <span>Type Notes</span>
                </Button>
                <Button 
                  onClick={() => setShowConsultationModal(true)}
                  className="h-24 flex flex-col gap-2"
                  variant="outline"
                >
                  <Download className="h-8 w-8" />
                  <span>Upload Audio</span>
                </Button>
              </div>

              <Separator />

              {/* Note Editor */}
              <div>
                <Label>Note Title</Label>
                <Input 
                  value={noteTitle} 
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Enter note title..."
                  className="mb-3"
                />
              </div>
              <div>
                <Label>Note Content</Label>
                <Textarea 
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter or paste your consultation notes here..."
                  className="min-h-[300px]"
                />
              </div>

              {noteText && (
                <div className="flex gap-2">
                  <Button onClick={() => setWorkflowStep(4)} disabled={!noteText.trim()}>
                    Review & Sign
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Assistant Sidebar */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-[calc(100%-60px)]">
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm">Hello! I can help with medical terminology, suggest diagnoses, or answer questions about this consultation.</p>
                  </div>
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn("p-3 rounded-lg text-sm", msg.role === 'user' ? "bg-muted ml-4" : "bg-primary/10 mr-4")}>
                      {msg.content}
                    </div>
                  ))}
                  {isAssistantThinking && (
                    <div className="p-3 bg-primary/10 rounded-lg flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChatMessage()}
                  placeholder="Ask a question..."
                  disabled={isAssistantThinking}
                />
                <Button onClick={handleSendChatMessage} disabled={!chatInput.trim() || isAssistantThinking} size="icon">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setWorkflowStep(2)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Consultation Modal */}
      <ConsultationModal
        isOpen={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
        onGeneratedNotes={handleGeneratedNotesFromConsultation}
        patientInfo={selectedPatient}
        noteType={selectedNoteType}
      />
    </div>
  );

  // Step 4: Review & Sign
  const renderReviewSign = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">Review & Sign</h2>
        <p className="text-muted-foreground">Review your note and add electronic signature</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Note Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{noteTitle || 'Medical Note'}</span>
                <Badge>{NOTE_TYPES.find(t => t.id === selectedNoteType)?.name}</Badge>
              </CardTitle>
              <CardDescription>
                Patient: {selectedPatient?.firstName} {selectedPatient?.lastName || ''} • {format(new Date(), 'MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/30 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm font-sans">{noteText}</pre>
              </div>
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <CardHeader>
              <CardTitle>Electronic Signature</CardTitle>
              <CardDescription>Sign to finalize this medical note</CardDescription>
            </CardHeader>
            <CardContent>
              {signatureData ? (
                <div className="space-y-4">
                  <SignatureDisplay signatureData={signatureData} />
                  <Button variant="outline" onClick={() => setSignatureData(null)}>
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
                    toast({ title: "Signature Captured", description: "Your electronic signature has been added." });
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={handleSaveNote} disabled={createNoteMutation.isPending}>
                {createNoteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save to Patient Record
              </Button>
              <Button variant="outline" className="w-full" onClick={handleDownloadNote} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download as Word
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowPreview(true)}>
                <Eye className="mr-2 h-4 w-4" />
                Print Preview
              </Button>
              <Separator />
              <Button variant="ghost" className="w-full" onClick={() => setWorkflowStep(3)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Edit Note
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showNoteSuccess} onOpenChange={setShowNoteSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Note Saved Successfully
            </DialogTitle>
          </DialogHeader>
          <p>The medical note has been saved to {selectedPatient?.firstName}'s record.</p>
          <DialogFooter>
            <Button variant="outline" onClick={resetWorkflow}>Create Another Note</Button>
            <Button onClick={() => setShowNoteSuccess(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{noteTitle}</DialogTitle>
          </DialogHeader>
          <div className="p-6 border rounded-lg bg-white">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans">{noteText}</pre>
            </div>
            {signatureData && (
              <div className="mt-6 pt-4 border-t">
                <SignatureDisplay signatureData={signatureData} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            <Button onClick={() => window.print()}>Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Medical Notes</h1>
        <p className="text-muted-foreground">AI-powered clinical documentation</p>
      </div>

      <WorkflowIndicator />

      {workflowStep === 1 && renderPatientSelection()}
      {workflowStep === 2 && renderPatientSummary()}
      {workflowStep === 3 && renderConsultation()}
      {workflowStep === 4 && renderReviewSign()}
    </div>
  );
}
