import { useQuery } from "@tanstack/react-query";
import { Patient, Appointment } from "@shared/schema";
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
  Heart
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface PatientDetailsProps {
  patientId: number;
}

export default function PatientDetails({ patientId }: PatientDetailsProps) {
  const { data: patient } = useQuery<Patient>({
    queryKey: [`/api/patients/${patientId}`],
  });

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  if (!patient) return null;

  const patientAppointments = appointments?.filter(a => a.patientId === patientId) || [];

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{patient.name}</h2>
            <div className="flex items-center gap-4 text-muted-foreground mt-1">
              <div className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                <span>{format(new Date(patient.dateOfBirth), "PPP")}</span>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Medical Alerts</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span>Penicillin Allergy</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-500">
                      <Pill className="h-4 w-4" />
                      <span>Current Medications: 2</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-500">
                      <Heart className="h-4 w-4" />
                      <span>Chronic Conditions: None</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Last visit: {format(new Date(), "PPP")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>Latest prescription: 1 week ago</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Syringe className="h-4 w-4 text-muted-foreground" />
                      <span>Vaccinations up to date</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="medical-history">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="prose max-w-none">
                  <h3 className="text-lg font-semibold">Medical History</h3>
                  <div className="space-y-4">
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-medium">Current Conditions</h4>
                      <p className="text-muted-foreground">{patient.medicalHistory || 'No current conditions recorded.'}</p>
                    </div>
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-medium">Allergies</h4>
                      <p className="text-muted-foreground">Penicillin</p>
                    </div>
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-medium">Past Surgeries</h4>
                      <p className="text-muted-foreground">None recorded</p>
                    </div>
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-medium">Family History</h4>
                      <p className="text-muted-foreground">No significant family history recorded</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[
                    { medication: "Amoxicillin", dosage: "500mg", frequency: "3x daily", date: "2024-03-01" },
                    { medication: "Ibuprofen", dosage: "400mg", frequency: "As needed", date: "2024-02-15" }
                  ].map((prescription, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{prescription.medication}</p>
                        <p className="text-sm text-muted-foreground">
                          {prescription.dosage} - {prescription.frequency}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Prescribed: {format(new Date(prescription.date), "PPP")}
                        </p>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[
                    { name: "Blood Test Results", type: "PDF", date: "2024-03-01" },
                    { name: "X-Ray Report", type: "Image", date: "2024-02-15" },
                    { name: "Vaccination Record", type: "PDF", date: "2024-01-20" }
                  ].map((document, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileWarning className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{document.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Added: {format(new Date(document.date), "PPP")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{document.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}