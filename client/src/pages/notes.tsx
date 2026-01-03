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

  // Fetch custom prompt
  const { data: customPrompt, isLoading: isLoadingPrompt } = useQuery<any>({
    queryKey: ["/api/custom-note-prompts", selectedNoteType],
    enabled: !!selectedNoteType && !!user?.id,
    queryFn: async () => {
      const res = await fetch(`/api/custom-note-prompts/${selectedNoteType}`);
      if (!res.ok) return null;
      return res.json();
    }
  });

  // Update prompt states when customPrompt is loaded
  useEffect(() => {
    if (customPrompt && customPrompt.id) {
      setSystemPrompt(customPrompt.systemPrompt || '');
      setTemplateContent(customPrompt.templateContent || '');
    }
  }, [customPrompt]);

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
      queryClient.invalidateQueries({ queryKey: ["/api/custom-note-prompts", selectedNoteType] });
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

  // Step 2: Note Type Selection (Simplified)
  const renderPatientSummary = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Select Consultation Type</h2>
        <p className="text-muted-foreground">Choose the type of medical note to create for {selectedPatient?.firstName}</p>
      </div>

      {/* Note Type Selection */}
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {NOTE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedNoteType(type.id)}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg bg-card",
                  selectedNoteType === type.id
                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                    : "border-muted hover:border-primary/50"
                )}
              >
                <div className="text-3xl mb-3">{type.icon}</div>
                <div className="font-semibold text-base mb-1">{type.name}</div>
                <div className="text-xs text-muted-foreground">{type.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between mt-8">
        <Button variant="outline" size="lg" onClick={() => setWorkflowStep(1)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button size="lg" onClick={() => setWorkflowStep(3)} className="px-8 h-12 text-lg">
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
                {/* Settings removed for simplicity */}
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
              <div className="hidden">
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

        {/* Doctor Helper Smart Sidebar */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Doctor Helper Smart
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-[calc(100%-60px)]">
              <Tabs defaultValue="assistant" className="h-full flex flex-col">
                <TabsList className="mb-4 grid grid-cols-2 w-full">
                  <TabsTrigger value="analysis" className="text-xs sm:text-sm">
                    Tips
                  </TabsTrigger>
                  <TabsTrigger value="assistant" className="text-xs sm:text-sm">Chat</TabsTrigger>
                </TabsList>

                <TabsContent value="analysis" className="flex-1 overflow-y-auto">
                  <div className="space-y-4 pr-2">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                      <h4 className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4" />
                        AI Analysis
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-200">
                        {aiSuggestion || "Select a patient and start consultation to get AI insights."}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="assistant" className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Ask me anything about the patient or medical guidelines.</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div key={i} className={cn("flex flex-col gap-1", msg.role === 'user' ? "items-end" : "items-start")}>
                          <div className={cn("p-3 rounded-lg text-sm max-w-[85%]", msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted")}>
                            {msg.content}
                          </div>
                          {msg.role === 'assistant' && (
                             <span className="text-[10px] text-muted-foreground ml-1">AI Generated - Verify Accuracy</span>
                          )}
                        </div>
                      ))
                    )}
                    {isAssistantThinking && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI is thinking...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      placeholder="Ask AI assistant..." 
                    />
                    <Button size="icon" onClick={handleSendChatMessage} disabled={!chatInput.trim() || isAssistantThinking}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
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
              <div className="p-4 bg-muted/30 rounded-lg relative">
                <div className="absolute top-2 right-2 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                  AI Generated - Verify Accuracy
                </div>
                <pre className="whitespace-pre-wrap text-sm font-sans pt-4">{noteText}</pre>
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
