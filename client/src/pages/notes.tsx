import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  ChevronsUpDown
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
import { Patient, InsertMedicalNote, MedicalNoteTemplate, InsertMedicalNoteTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ConsultationModal } from "@/components/consultation-modal";
// Import individual dialog components
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog";
import { DialogHeader } from "@/components/ui/dialog";
import { DialogTitle } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { DialogTrigger } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function Notes() {
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [showNoteSuccess, setShowNoteSuccess] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNoteType, setSelectedNoteType] = useState<"soap" | "progress" | "procedure" | "consultation" | "initial" | "followup" | "physical" | "reevaluation" | "psychiatric" | "discharge">("soap");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Generate a SOAP note structure if none exists
  useEffect(() => {
    if (!noteText && selectedPatientId) {
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
  }, [selectedPatientId, noteText]);

  // Fetch patients
  const { data: patients, isLoading: isLoadingPatients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch note templates
  const { data: noteTemplates, isLoading: isLoadingTemplates } = useQuery<MedicalNoteTemplate[]>({
    queryKey: ["/api/medical-note-templates"],
  });

  // Get selected patient details
  const selectedPatient = patients?.find(patient => patient.id === selectedPatientId);
  
  // Get selected template
  const selectedTemplate = noteTemplates?.find(template => template.type === selectedNoteType);

  // Create medical note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: InsertMedicalNote) => {
      const res = await apiRequest("POST", "/api/medical-notes", noteData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-notes"] });
      setShowNoteSuccess(true);
      toast({
        title: "Success",
        description: "Medical note saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: InsertMedicalNoteTemplate) => {
      let url = "/api/medical-note-templates";
      let method = "POST";
      
      // If template already exists, update it instead
      if (selectedTemplate?.id) {
        url = `/api/medical-note-templates/${selectedTemplate.id}`;
        method = "PUT";
      }
      
      const res = await apiRequest(method, url, templateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-note-templates"] });
      setIsSettingsOpen(false);
      toast({
        title: "Success",
        description: "Template settings saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartConsultation = () => {
    if (!selectedPatientId) {
      toast({
        title: "Patient Required",
        description: "Please select a patient before starting consultation",
        variant: "destructive",
      });
      return;
    }
    
    setShowConsultationModal(true);
  };
  
  const handleGeneratedNotesFromConsultation = (notes: string) => {
    setNoteText(notes);
    setNoteTitle(`${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ""} - Consultation Notes ${format(new Date(), "yyyy-MM-dd")}`);
  };

  const handleGenerateNotes = () => {
    if (!selectedPatientId) {
      toast({
        title: "Patient Required",
        description: "Please select a patient before generating notes",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    
    // Simulate AI generating notes
    setTimeout(() => {
      const patient = patients?.find(p => p.id === selectedPatientId);
      if (patient) {
        setNoteText(
`SOAP Note for ${patient.firstName} ${patient.lastName || ''}

Subjective:
- Patient complains of ${Math.random() > 0.5 ? "headache" : "sore throat"} for the past ${Math.floor(Math.random() * 5) + 1} days
- Reports ${Math.random() > 0.5 ? "mild fever" : "no fever"}
- ${Math.random() > 0.5 ? "Difficulty sleeping" : "Normal sleep patterns"}

Objective:
- Temperature: ${Math.floor(Math.random() * 2) + 98}.${Math.floor(Math.random() * 9)}°F
- Blood Pressure: ${Math.floor(Math.random() * 20) + 110}/${Math.floor(Math.random() * 10) + 70} mmHg
- Respiratory rate: ${Math.floor(Math.random() * 4) + 16} breaths/minute

Assessment:
- ${Math.random() > 0.5 ? "Upper respiratory infection" : "Viral pharyngitis"}
- No signs of secondary bacterial infection
- Patient is well-hydrated

Plan:
- Rest and hydration
- ${Math.random() > 0.5 ? "Acetaminophen" : "Ibuprofen"} for pain/fever as needed
- Return if symptoms worsen or do not improve within 3-5 days
- Follow-up in 1 week if needed
`);
        setNoteTitle(`${patient.firstName} ${patient.lastName || ''} - ${Math.random() > 0.5 ? "Follow Up" : "Initial Consultation"}`);
      }
      setIsGenerating(false);
    }, 2000);
  };

  const handleSaveNote = () => {
    if (!selectedPatientId) {
      toast({
        title: "Patient Required",
        description: "Please select a patient before saving notes",
        variant: "destructive",
      });
      return;
    }

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
      patientId: selectedPatientId,
      doctorId: user?.id || 1,
      content: noteText,
      type: "soap",
      title: noteTitle
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Medical Notes</h1>
          <p className="text-muted-foreground">Generate and manage medical notes with AI assistance</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Medical Notes Settings</DialogTitle>
                <DialogDescription>
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
                      <SelectItem value="soap">SOAP Note</SelectItem>
                      <SelectItem value="initial">Initial Consultation</SelectItem>
                      <SelectItem value="followup">Follow-up Visit</SelectItem>
                      <SelectItem value="physical">Physical Examination</SelectItem>
                      <SelectItem value="reevaluation">Re-evaluation Note</SelectItem>
                      <SelectItem value="procedure">Procedure Note</SelectItem>
                      <SelectItem value="psychiatric">Psychiatric Evaluation</SelectItem>
                      <SelectItem value="discharge">Discharge Summary</SelectItem>
                      <SelectItem value="progress">Progress Note</SelectItem>
                      <SelectItem value="consultation">Consultation Note</SelectItem>
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
                    const title = selectedNoteType.charAt(0).toUpperCase() + selectedNoteType.slice(1) + " Note Template";
                    saveTemplateMutation.mutate({
                      type: selectedNoteType,
                      title: title,
                      systemPrompt: systemPrompt || selectedTemplate?.systemPrompt || "",
                      template: templateContent || selectedTemplate?.template || ""
                    } as InsertMedicalNoteTemplate);
                  }}
                  disabled={saveTemplateMutation.isPending}
                >
                  {saveTemplateMutation.isPending ? (
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
          <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={patientSearchOpen}
                className="w-[250px] justify-between"
              >
                {selectedPatientId ? (
                  patients?.find((patient) => patient.id === selectedPatientId)
                    ? `${patients.find((patient) => patient.id === selectedPatientId)!.firstName} ${patients.find((patient) => patient.id === selectedPatientId)!.lastName || ''}`
                    : "Select Patient"
                ) : (
                  "Select Patient"
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
              <Command>
                <CommandInput placeholder="Search patients..." />
                <CommandList>
                  <CommandEmpty>No patient found.</CommandEmpty>
                  <CommandGroup>
                    {isLoadingPatients ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </div>
                    ) : patients?.length ? (
                      patients.map((patient) => (
                        <CommandItem
                          key={patient.id}
                          value={`${patient.firstName} ${patient.lastName || ''}`}
                          onSelect={() => {
                            setSelectedPatientId(patient.id);
                            setPatientSearchOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedPatientId === patient.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {`${patient.firstName} ${patient.lastName || ''}`}
                        </CommandItem>
                      ))
                    ) : (
                      <div className="text-center p-2 text-muted-foreground">No patients found</div>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={handleStartConsultation}
            disabled={!selectedPatientId}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Start Consultation
          </Button>
          <Button 
            onClick={handleGenerateNotes} 
            disabled={isGenerating || !selectedPatientId}
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

      {selectedPatient && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{`${selectedPatient.firstName} ${selectedPatient.lastName || ''}`}</h3>
                <div className="text-sm text-muted-foreground flex gap-4">
                  <span>DOB: {selectedPatient.dateOfBirth}</span>
                  <span>Email: {selectedPatient.email}</span>
                  <span>Phone: {selectedPatient.phone}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SOAP Note</CardTitle>
            {selectedPatient ? (
              <CardDescription>Writing note for {`${selectedPatient.firstName} ${selectedPatient.lastName || ''}`}</CardDescription>
            ) : (
              <CardDescription>Select a patient to begin</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="noteTitle">Note Title</Label>
                <Input
                  id="noteTitle"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Enter note title"
                  disabled={!selectedPatientId}
                  className="mb-4"
                />
              </div>
              <Textarea
                placeholder="Select a patient and start typing or record your notes..."
                className="min-h-[300px]"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={!selectedPatientId}
              />
              <Button 
                className="w-full" 
                onClick={handleSaveNote}
                disabled={!selectedPatientId || !noteText.trim() || !noteTitle.trim() || createNoteMutation.isPending}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="templates">
              <TabsList className="mb-4">
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="assistant">Doctor Assistant</TabsTrigger>
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
                      if (selectedPatientId) {
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
                      } else {
                        toast({
                          title: "Patient Required",
                          description: "Please select a patient first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Initial Consultation
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedPatientId) {
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
                      } else {
                        toast({
                          title: "Patient Required",
                          description: "Please select a patient first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Follow-up Visit
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedPatientId) {
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
                      } else {
                        toast({
                          title: "Patient Required",
                          description: "Please select a patient first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Physical Examination
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedPatientId) {
                        setNoteTitle("Re-evaluation Note");
                        setNoteText(
`Re-evaluation Note

Patient Information:
- Name: ${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ''}
- Date of Service: ${format(new Date(), "yyyy-MM-dd")}

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

Follow-up:
- Recommended follow-up timeframe:
- Additional testing:
- Referrals:
`);
                      } else {
                        toast({
                          title: "Patient Required",
                          description: "Please select a patient first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Re-evaluation Note
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedPatientId) {
                        setNoteTitle("Procedure Note");
                        setNoteText(
`Procedure Note

Patient Information:
- Name: ${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ''}
- Date of Procedure: ${format(new Date(), "yyyy-MM-dd")}

Procedure Details:
- Procedure name:
- Indication:
- Location performed:
- Consent obtained: Yes/No

Pre-Procedure Assessment:
- Vital signs:
- Relevant examination findings:
- Pre-procedure medications:
- Allergies:

Procedure Description:
- Technique:
- Equipment used:
- Specimens collected:
- Medications administered:
- Local anesthetic details:
- Complications:

Post-Procedure Assessment:
- Vital signs:
- Patient status:
- Pain level:

Follow-up Instructions:
- Activity restrictions:
- Wound care:
- Medications:
- Follow-up appointment:
- When to seek medical attention:

Provider Signature: ______________________________
`);
                      } else {
                        toast({
                          title: "Patient Required",
                          description: "Please select a patient first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Procedure Note
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedPatientId) {
                        setNoteTitle("Psychiatric Evaluation");
                        setNoteText(
`Psychiatric Evaluation

Patient Information:
- Name: ${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ''}
- Date of Evaluation: ${format(new Date(), "yyyy-MM-dd")}

Chief Complaint:
- 

History of Present Illness:
- 

Psychiatric History:
- Previous diagnoses:
- Previous treatments:
- Previous hospitalizations:
- Medication trials and responses:

Medical History:
- Relevant conditions:
- Current medications:
- Allergies:

Substance Use History:
- 

Family Psychiatric History:
- 

Social History:
- 

Mental Status Examination:
- Appearance:
- Behavior:
- Speech:
- Mood and affect:
- Thought process:
- Thought content:
- Perception:
- Cognition:
- Insight:
- Judgment:

Risk Assessment:
- Suicidal ideation:
- Homicidal ideation:
- Self-harm behaviors:
- Violence risk:

Diagnosis:
- 

Treatment Plan:
- Medications:
- Therapy recommendations:
- Level of care:
- Follow-up plan:

Provider Signature: ______________________________
`);
                      } else {
                        toast({
                          title: "Patient Required",
                          description: "Please select a patient first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Psychiatric Evaluation
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedPatientId) {
                        setNoteTitle("Discharge Summary");
                        setNoteText(
`Discharge Summary

Patient Information:
- Name: ${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ''}
- Admission Date:
- Discharge Date: ${format(new Date(), "yyyy-MM-dd")}
- Length of Stay:

Admission Diagnosis:
- 

Discharge Diagnosis:
- Primary:
- Secondary:

Brief History:
- 

Hospital Course:
- 

Procedures Performed:
- 

Consultations:
- 

Significant Lab/Imaging Results:
- 

Condition at Discharge:
- 

Discharge Medications:
- 

Discharge Instructions:
- Activity restrictions:
- Diet:
- Wound care:
- Follow-up appointments:

Prognosis:
- 

Provider Signature: ______________________________
`);
                      } else {
                        toast({
                          title: "Patient Required",
                          description: "Please select a patient first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Discharge Summary
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="analysis">
                <div className="text-center text-muted-foreground py-8">
                  {selectedPatientId ? (
                    <div className="space-y-4">
                      <div className="border p-3 rounded-md">
                        <p className="font-medium">Keywords Analysis</p>
                        <p className="text-sm text-muted-foreground">
                          The medical note contains references to vital signs, symptoms, and treatment plan.
                        </p>
                      </div>
                      <div className="border p-3 rounded-md">
                        <p className="font-medium">Missing Information</p>
                        <p className="text-sm text-muted-foreground">
                          Consider adding details about medication dosages and follow-up timing.
                        </p>
                      </div>
                      <div className="border p-3 rounded-md">
                        <p className="font-medium">Documentation Tips</p>
                        <p className="text-sm text-muted-foreground">
                          Ensure clear documentation of patient education and instructions provided.
                        </p>
                      </div>
                    </div>
                  ) : (
                    "AI analysis will appear when a patient is selected"
                  )}
                </div>
              </TabsContent>
              <TabsContent value="assistant">
                <div className="h-[400px] flex flex-col">
                  <div className="flex-1 border rounded-md mb-4 p-4 overflow-y-auto bg-secondary/5" id="assistant-chat-area">
                    <div className="space-y-4">
                      <div className="flex justify-start">
                        <div className="bg-primary/10 rounded-lg p-3 max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1">
                            <Stethoscope className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">AI Assistant</span>
                          </div>
                          <p className="text-sm">Hello! I'm your AI medical assistant. How can I help you today? You can ask me about medical conditions, treatments, or help with note-taking.</p>
                        </div>
                      </div>
                      {/* Chat messages will be added here dynamically */}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Ask a medical question or request help with your note..." 
                      id="assistant-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const input = document.getElementById('assistant-input') as HTMLInputElement;
                          const chatArea = document.getElementById('assistant-chat-area');
                          
                          if (input.value.trim() && chatArea) {
                            // Add user message to chat
                            const userDiv = document.createElement('div');
                            userDiv.className = 'flex justify-end my-4';
                            userDiv.innerHTML = `
                              <div class="bg-primary text-primary-foreground rounded-lg p-3 max-w-[85%]">
                                <div class="flex items-center gap-2 mb-1">
                                  <span class="font-medium text-sm">You</span>
                                  <UserPlus class="h-4 w-4" />
                                </div>
                                <p class="text-sm">${input.value.trim()}</p>
                              </div>
                            `;
                            chatArea.appendChild(userDiv);
                            
                            // Add loading message
                            const loadingDiv = document.createElement('div');
                            loadingDiv.className = 'flex justify-start my-4 ai-loading';
                            loadingDiv.innerHTML = `
                              <div class="bg-primary/10 rounded-lg p-3 max-w-[85%]">
                                <div class="flex items-center gap-2 mb-1">
                                  <Stethoscope class="h-4 w-4 text-primary" />
                                  <span class="font-medium text-sm">AI Assistant</span>
                                </div>
                                <p class="text-sm flex items-center">
                                  <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                                  Thinking...
                                </p>
                              </div>
                            `;
                            chatArea.appendChild(loadingDiv);
                            
                            // Scroll to bottom
                            chatArea.scrollTop = chatArea.scrollHeight;
                            
                            // Prepare messages for API
                            const messages = [
                              {
                                role: 'system',
                                content: 'You are an AI medical assistant helping a healthcare professional. Provide accurate, evidence-based information and always clarify that the doctor should use their professional judgment. Keep responses concise and relevant to medical practice.'
                              },
                              {
                                role: 'user',
                                content: input.value.trim()
                              }
                            ];
                            
                            // Call API
                            fetch('/api/ai/chat', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ messages }),
                            })
                              .then(response => response.json())
                              .then(data => {
                                // Remove loading message
                                const loadingElement = chatArea.querySelector('.ai-loading');
                                if (loadingElement) {
                                  chatArea.removeChild(loadingElement);
                                }
                                
                                // Add AI response
                                const aiDiv = document.createElement('div');
                                aiDiv.className = 'flex justify-start my-4';
                                aiDiv.innerHTML = `
                                  <div class="bg-primary/10 rounded-lg p-3 max-w-[85%]">
                                    <div class="flex items-center gap-2 mb-1">
                                      <Stethoscope class="h-4 w-4 text-primary" />
                                      <span class="font-medium text-sm">AI Assistant</span>
                                    </div>
                                    <p class="text-sm">${data.content || 'Sorry, I encountered an error.'}</p>
                                  </div>
                                `;
                                chatArea.appendChild(aiDiv);
                                
                                // Scroll to bottom
                                chatArea.scrollTop = chatArea.scrollHeight;
                              })
                              .catch(error => {
                                console.error('Error calling AI API:', error);
                                
                                // Remove loading message
                                const loadingElement = chatArea.querySelector('.ai-loading');
                                if (loadingElement) {
                                  chatArea.removeChild(loadingElement);
                                }
                                
                                // Add error message
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'flex justify-start my-4';
                                errorDiv.innerHTML = `
                                  <div class="bg-destructive/10 text-destructive rounded-lg p-3 max-w-[85%]">
                                    <div class="flex items-center gap-2 mb-1">
                                      <Stethoscope class="h-4 w-4" />
                                      <span class="font-medium text-sm">AI Assistant</span>
                                    </div>
                                    <p class="text-sm">Sorry, I encountered an error processing your request.</p>
                                  </div>
                                `;
                                chatArea.appendChild(errorDiv);
                                
                                // Scroll to bottom
                                chatArea.scrollTop = chatArea.scrollHeight;
                              });
                            
                            // Clear input
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <Button 
                      onClick={() => {
                        const input = document.getElementById('assistant-input') as HTMLInputElement;
                        // Trigger Enter key event
                        if (input.value.trim()) {
                          const event = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            bubbles: true
                          });
                          input.dispatchEvent(event);
                        }
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      Ask
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
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
          <div className="py-4">
            <p>
              The medical note for {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName || ''}` : ''} has been saved successfully. 
              The note will be available in the patient's record.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setShowNoteSuccess(false);
              setNoteText("");
              setNoteTitle("");
            }}>
              Create Another Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consultation Modal */}
      <ConsultationModal
        isOpen={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
        onGeneratedNotes={handleGeneratedNotesFromConsultation}
        patientInfo={selectedPatient}
      />
    </div>
  );
}
