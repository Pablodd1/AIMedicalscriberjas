import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  UserPlus
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
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ConsultationModal } from "@/components/consultation-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function QuickNotes() {
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteSuccess, setShowNoteSuccess] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNoteType, setSelectedNoteType] = useState<"initial" | "followup" | "physical" | "reevaluation" | "procedure" | "psychiatric" | "discharge">("initial");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
  }, [noteText]);

  // Fetch note templates
  const { data: templates } = useQuery({
    queryKey: ["/api/note-templates", selectedNoteType],
    enabled: isSettingsOpen,
  });

  const selectedTemplate = templates?.find((t: any) => t.noteType === selectedNoteType);

  // Create quick note mutation
  const createNoteMutation = useMutation({
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
      // Reset form
      setNoteText("");
      setNoteTitle("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save note",
        variant: "destructive",
      });
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

  const handleStartConsultation = () => {
    setShowConsultationModal(true);
  };

  const handleConsultationComplete = (transcript: string, notes: string) => {
    if (notes) {
      setNoteText(notes);
      setNoteTitle(`Quick Note - ${format(new Date(), "MM/dd/yyyy")}`);
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
      const messages = [
        {
          role: 'system',
          content: 'You are an AI medical assistant helping a healthcare professional with quick note documentation. Provide accurate, evidence-based information and help with note-taking. Keep responses concise and relevant to medical practice.'
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
          patientInfo: {
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
        setNoteTitle(`Quick Note - ${selectedNoteType.charAt(0).toUpperCase() + selectedNoteType.slice(1)}`);
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

    createNoteMutation.mutate({
      doctorId: user?.id || 1,
      content: noteText,
      type: "soap",
      title: noteTitle
    });
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
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Quick Note • Generated ${new Date().toLocaleDateString('en-US')}`,
              italics: true,
              size: 20,
            }),
          ],
        })
      );
      
      docSections.push(new Paragraph({ text: "" })); // Empty line
      
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

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <ConsultationModal
        open={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
        onComplete={handleConsultationComplete}
        patientId={null}
        patientName="Quick Note"
      />

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Note Preview</DialogTitle>
            <DialogDescription className="text-sm">Preview your quick note before saving</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border rounded-md p-6 bg-background">
              <h2 className="text-2xl font-bold mb-4">{noteTitle || "Untitled Note"}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {new Date().toLocaleDateString('en-US')} • Quick Note
              </p>
              <div className="prose max-w-none">
                {noteText.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 whitespace-pre-wrap">{line}</p>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Quick Notes</h1>
          <p className="text-sm md:text-base text-muted-foreground">Create medical notes without patient selection</p>
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
                <DialogTitle className="text-lg md:text-xl">Quick Notes Settings</DialogTitle>
                <DialogDescription className="text-sm">
                  Configure templates and prompts used for note generation
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="noteType">Note Type</Label>
                  <Select
                    value={selectedNoteType}
                    onValueChange={(value) => setSelectedNoteType(value as any)}
                  >
                    <SelectTrigger id="noteType">
                      <SelectValue placeholder="Select Note Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">Initial Consultation</SelectItem>
                      <SelectItem value="followup">Follow-up Visit</SelectItem>
                      <SelectItem value="physical">Physical Examination</SelectItem>
                      <SelectItem value="reevaluation">Re-evaluation Note</SelectItem>
                      <SelectItem value="procedure">Procedure Note</SelectItem>
                      <SelectItem value="psychiatric">Psychiatric Evaluation</SelectItem>
                      <SelectItem value="discharge">Discharge Summary</SelectItem>
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
                  <p className="text-sm text-muted-foreground">
                    This is the main instruction for the AI assistant when generating this type of note.
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    This is the structure that will be used when creating this type of note.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsSettingsOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    saveCustomPromptMutation.mutate({
                      noteType: selectedNoteType,
                      systemPrompt: systemPrompt || selectedTemplate?.systemPrompt || "",
                      templateContent: templateContent || selectedTemplate?.template || ""
                    });
                  }}
                  disabled={saveCustomPromptMutation.isPending}
                  data-testid="button-save-settings"
                >
                  {saveCustomPromptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Custom Prompt"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={handleStartConsultation}
            className="w-full sm:w-auto"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Start Consultation</span>
            <span className="sm:hidden">Consult</span>
          </Button>
          <Button 
            onClick={handleGenerateNotes} 
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate SOAP
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">SOAP Note</CardTitle>
            <CardDescription className="text-sm">Create a quick note without patient selection</CardDescription>
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
                placeholder="Start typing or record your notes..."
                className="min-h-[250px] md:min-h-[300px] text-sm md:text-base"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  disabled={!noteText.trim() || !noteTitle.trim()}
                  data-testid="button-preview-note"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleDownloadNote}
                  disabled={!noteText.trim() || !noteTitle.trim() || isDownloading}
                  data-testid="button-download-note"
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
                <Button 
                  onClick={handleSaveNote}
                  disabled={!noteText.trim() || !noteTitle.trim() || createNoteMutation.isPending}
                  data-testid="button-save-note"
                >
                  {createNoteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Note
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">AI Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="templates">
              <TabsList className="mb-4 grid grid-cols-3 w-full">
                <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
                <TabsTrigger value="analysis" className="text-xs sm:text-sm">Analysis</TabsTrigger>
                <TabsTrigger value="assistant" className="text-xs sm:text-sm">Assistant</TabsTrigger>
              </TabsList>
              <TabsContent value="templates">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a template to quickly create standardized notes
                  </p>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setNoteTitle("SOAP - Initial Consultation");
                      setNoteText(
`SOAP Note

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
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Initial Consultation
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setNoteTitle("SOAP - Follow-up Visit");
                      setNoteText(
`SOAP Note - Follow-up

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
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Follow-up Visit
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setNoteTitle("SOAP - Physical Examination");
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
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Physical Examination
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setNoteTitle("Re-evaluation Note");
                      setNoteText(
`Re-evaluation Note

Date of Service: ${format(new Date(), "MM/dd/yyyy")}

Reason for Re-evaluation:
- 

Previous Diagnosis:
- 

Changes Since Last Visit:
- Symptom changes:
- Response to treatment:
- Medication adjustments:
- New concerns:

Current Assessment:
- Updated diagnosis:
- Disease progression/regression:
- Functional status:

Treatment Plan Modifications:
- Medication changes:
- Therapy adjustments:
- New interventions:

Goals and Prognosis:
- Short-term goals:
- Long-term goals:
- Expected outcomes:
`);
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Re-evaluation Note
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="analysis">
                <div className="text-center text-muted-foreground py-8">
                  <div className="space-y-4">
                    <div className="border p-3 rounded-md text-left">
                      <p className="font-medium mb-2">Quick Notes Overview</p>
                      <p className="text-sm text-muted-foreground">
                        Quick notes allow you to create medical documentation without patient selection. This is useful for general observations, personal reminders, or documentation that will be linked to a patient later.
                      </p>
                    </div>
                    <div className="border p-3 rounded-md text-left">
                      <p className="font-medium mb-2">Documentation Tips</p>
                      <p className="text-sm text-muted-foreground">
                        • Be specific and concise<br />
                        • Include relevant timestamps<br />
                        • Use standard medical terminology<br />
                        • Document objectively and factually
                      </p>
                    </div>
                    <div className="border p-3 rounded-md text-left">
                      <p className="font-medium mb-2">Note Types</p>
                      <p className="text-sm text-muted-foreground">
                        <strong>SOAP:</strong> Structured clinical documentation<br />
                        <strong>Progress:</strong> Track improvements over time<br />
                        <strong>Procedure:</strong> Document interventions and outcomes
                      </p>
                    </div>
                  </div>
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
                          <p className="text-sm">Hello! I'm your AI medical assistant. How can I help you with your quick note today?</p>
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
                      placeholder="Ask a medical question or request help with your note..." 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      disabled={isAssistantThinking}
                      data-testid="input-assistant-chat"
                    />
                    <Button 
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim() || isAssistantThinking}
                      data-testid="button-send-chat"
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
