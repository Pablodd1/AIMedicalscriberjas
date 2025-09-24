import { useQuery } from "@tanstack/react-query";
import { Patient, Appointment, MedicalNote } from "@shared/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CalendarDays,
  FileText,
  Phone,
  Mail,
  MapPin,
  Clock,
  Activity,
  Pill,
  FileWarning,
  Syringe,
  Heart,
  Loader2,
  Copy,
  Check,
  Download,
  FlaskConical,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { DocumentManager } from "@/components/patient-documents/document-manager";
import { EditablePatientSection } from "@/components/patient-management/editable-patient-section";

interface PatientDetailsProps {
  patientId: number;
}

export default function PatientDetails({ patientId }: PatientDetailsProps) {
  const [copiedNote, setCopiedNote] = useState<number | null>(null);
  const [downloadingNote, setDownloadingNote] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: patient } = useQuery<Patient>({
    queryKey: [`/api/patients/${patientId}`],
  });

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: medicalNotes, isLoading: isLoadingNotes } = useQuery<MedicalNote[]>({
    queryKey: [`/api/patients/${patientId}/medical-notes`],
    enabled: !!patientId,
  });

  const { data: labReports, isLoading: isLoadingLabReports } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/lab-reports`],
    enabled: !!patientId,
  });

  // New queries for patient management data
  const { data: medicalAlerts, isLoading: isLoadingAlerts } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/medical-alerts`],
    enabled: !!patientId,
  });

  const { data: patientActivity, isLoading: isLoadingActivity } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/activity`],
    enabled: !!patientId,
  });

  const { data: prescriptions, isLoading: isLoadingPrescriptions } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/prescriptions`],
    enabled: !!patientId,
  });

  const { data: medicalHistory, isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/medical-history`],
    enabled: !!patientId,
  });

  if (!patient) return null;

  const patientAppointments = appointments?.filter(a => a.patientId === patientId) || [];
  
  const handleCopyNote = (content: string, noteId: number) => {
    navigator.clipboard.writeText(content);
    setCopiedNote(noteId);
    toast({
      title: "Copied",
      description: "Note copied to clipboard",
    });
    setTimeout(() => setCopiedNote(null), 3000);
  };

  const handleDownloadNote = async (noteId: number) => {
    try {
      setDownloadingNote(noteId);
      
      const response = await fetch(`/api/medical-notes/${noteId}/download`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to download note');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or create a default one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `medical-note-${noteId}-${new Date().toISOString().split('T')[0]}.docx`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Downloaded",
        description: "Medical note downloaded successfully",
      });
      
    } catch (error) {
      console.error("Failed to download note:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download the medical note",
        variant: "destructive",
      });
    } finally {
      setDownloadingNote(null);
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{`${patient.firstName} ${patient.lastName || ''}`}</h2>
            <div className="flex items-center gap-4 text-muted-foreground mt-1">
              <div className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                <span>{patient.dateOfBirth ? format(new Date(patient.dateOfBirth), "PPP") : "No DOB"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                <span>{patient.phone}</span>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="medical-history">Medical History</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{patient.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{patient.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{patient.address}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <EditablePatientSection
                patientId={patientId}
                title="Medical Alerts"
                icon={<AlertCircle className="h-4 w-4" />}
                data={medicalAlerts || []}
                type="alerts"
                isLoading={isLoadingAlerts}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <EditablePatientSection
                patientId={patientId}
                title="Recent Activity"
                icon={<Activity className="h-4 w-4" />}
                data={patientActivity || []}
                type="activity"
                isLoading={isLoadingActivity}
              />

              <EditablePatientSection
                patientId={patientId}
                title="Current Prescriptions"
                icon={<Pill className="h-4 w-4" />}
                data={prescriptions || []}
                type="prescriptions"
                isLoading={isLoadingPrescriptions}
              />
            </div>
          </TabsContent>

          <TabsContent value="medical-history">
            <EditablePatientSection
              patientId={patientId}
              title="Medical History Entries"
              icon={<FileText className="h-4 w-4" />}
              data={medicalHistory || []}
              type="history"
              isLoading={isLoadingHistory}
            />
          </TabsContent>

          <TabsContent value="appointments">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {patientAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{format(new Date(appointment.date), "PPP p")}</p>
                        <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                      </div>
                      <Badge variant={appointment.status === "completed" ? "secondary" : "default"}>
                        {appointment.status}
                      </Badge>
                    </div>
                  ))}
                  {patientAppointments.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No appointments recorded
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prescriptions">
            <EditablePatientSection
              patientId={patientId}
              title="Current Prescriptions"
              icon={<Pill className="h-4 w-4" />}
              data={prescriptions || []}
              type="prescriptions"
              isLoading={isLoadingPrescriptions}
            />
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-8">
                  {/* Document Manager */}
                  <DocumentManager patientId={patientId} />
                  
                  {/* Medical Notes Section */}
                  <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Medical Notes</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.href = "/notes"}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Create New Note
                      </Button>
                    </div>
                    
                    {isLoadingNotes ? (
                      <div className="flex justify-center items-center p-8 border rounded-lg">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : !medicalNotes || medicalNotes.length === 0 ? (
                      <div className="text-center p-8 text-muted-foreground border rounded-lg">
                        <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                        <p>No medical notes found for this patient</p>
                        <Button 
                          variant="outline" 
                          className="mt-2"
                          onClick={() => window.location.href = "/notes"}
                        >
                          Create New Note
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {medicalNotes.map((note) => (
                          <div key={note.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium">{note.title || 'Medical Note'}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {note.createdAt ? format(new Date(note.createdAt), "PPP p") : 'No date'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyNote(note.content, note.id)}
                                >
                                  {copiedNote === note.id ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadNote(note.id)}
                                  disabled={downloadingNote === note.id}
                                >
                                  {downloadingNote === note.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </Button>
                                <Badge variant="outline">{note.type || 'Note'}</Badge>
                              </div>
                            </div>
                            <div className="mt-2 p-3 bg-muted/50 rounded-md max-h-60 overflow-y-auto">
                              <pre className="whitespace-pre-wrap font-sans text-sm">{note.content}</pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lab Reports Section */}
                  <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Lab Reports</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.href = "/lab-interpreter"}
                      >
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Analyze New Report
                      </Button>
                    </div>
                    
                    {isLoadingLabReports ? (
                      <div className="flex justify-center items-center p-8 border rounded-lg">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : !labReports || labReports.length === 0 ? (
                      <div className="text-center p-8 text-muted-foreground border rounded-lg">
                        <FlaskConical className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                        <p>No lab reports found for this patient</p>
                        <Button 
                          variant="outline" 
                          className="mt-2"
                          onClick={() => window.location.href = "/lab-interpreter"}
                        >
                          Analyze New Report
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {labReports.map((report) => (
                          <div key={report.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium">{report.title || 'Lab Report'}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {report.createdAt ? format(new Date(report.createdAt), "PPP p") : 'No date'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const reportContent = `${report.title}\n\nOriginal Data:\n${report.reportData}\n\nAnalysis:\n${report.analysis}`;
                                    navigator.clipboard.writeText(reportContent);
                                    toast({
                                      title: "Copied",
                                      description: "Lab report copied to clipboard",
                                    });
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Badge variant="outline">
                                  <FlaskConical className="h-3 w-3 mr-1" />
                                  {report.reportType || 'Lab'}
                                </Badge>
                              </div>
                            </div>
                            {report.analysis && (
                              <div className="mt-2">
                                <div className="p-3 bg-blue-50 rounded-md max-h-60 overflow-y-auto">
                                  <h5 className="font-medium text-sm mb-2">Analysis Results:</h5>
                                  <div className="text-sm">
                                    {typeof report.analysis === 'string' ? (
                                      (() => {
                                        try {
                                          const parsed = JSON.parse(report.analysis);
                                          return (
                                            <div className="space-y-2">
                                              {parsed.summary && (
                                                <div>
                                                  <strong>Summary:</strong>
                                                  <p className="text-muted-foreground">{parsed.summary}</p>
                                                </div>
                                              )}
                                              {parsed.abnormalValues && Array.isArray(parsed.abnormalValues) && parsed.abnormalValues.length > 0 && (
                                                <div>
                                                  <strong>Abnormal Values:</strong>
                                                  <ul className="list-disc list-inside text-muted-foreground">
                                                    {parsed.abnormalValues.map((value: any, idx: number) => (
                                                      <li key={idx}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                              {parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 && (
                                                <div>
                                                  <strong>Recommendations:</strong>
                                                  <ul className="list-disc list-inside text-muted-foreground">
                                                    {parsed.recommendations.map((rec: any, idx: number) => (
                                                      <li key={idx}>{typeof rec === 'object' ? JSON.stringify(rec) : String(rec)}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        } catch (e) {
                                          return <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{String(report.analysis)}</pre>;
                                        }
                                      })()
                                    ) : (
                                      <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{typeof report.analysis === 'object' ? JSON.stringify(report.analysis, null, 2) : String(report.analysis)}</pre>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}