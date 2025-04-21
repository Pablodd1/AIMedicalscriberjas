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
  MessageSquare
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
import { Patient, InsertMedicalNote } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ConsultationModal } from "@/components/consultation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

  // Get selected patient details
  const selectedPatient = patients?.find(patient => patient.id === selectedPatientId);

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
          <Select 
            value={selectedPatientId?.toString() || ""}
            onValueChange={(value) => setSelectedPatientId(parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Patient" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingPatients ? (
                <div className="flex items-center justify-center p-2">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : patients?.length ? (
                patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id.toString()}>
                    {`${patient.firstName} ${patient.lastName || ''}`}
                  </SelectItem>
                ))
              ) : (
                <div className="text-center p-2 text-muted-foreground">No patients found</div>
              )}
            </SelectContent>
          </Select>
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
