import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash, Send, Copy, ExternalLink, Eye, CheckCircle, Clock, XCircle, Link2, QrCode, Mail, RefreshCw, Mic, ClipboardList, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// Schema for creating a new intake form
const createIntakeFormSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
});

type CreateIntakeFormData = z.infer<typeof createIntakeFormSchema>;

export default function PatientIntakeFormPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Form for creating a new intake form
  const form = useForm<CreateIntakeFormData>({
    resolver: zodResolver(createIntakeFormSchema),
    defaultValues: {
      patientId: "",
      name: "",
      email: "",
      phone: "",
    },
  });

  // Define patient and intake form types
  interface Patient {
    id: number;
    firstName: string;
    lastName: string | null;
    email: string;
    phone?: string;
  }

  interface IntakeForm {
    id: number;
    patientId: number;
    doctorId: number;
    name: string;
    email: string;
    phone?: string;
    status: string;
    uniqueLink: string;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
    expiresAt?: string;
  }

  // Fetch all patients for the select dropdown
  const { data: patients, isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    staleTime: 30000, // 30 seconds
  });

  // Fetch all intake forms
  const { data: intakeForms, isLoading: formsLoading } = useQuery<IntakeForm[]>({
    queryKey: ["/api/intake-forms"],
    staleTime: 30000, // 30 seconds
  });

  // Mutation for creating a new intake form
  const createIntakeFormMutation = useMutation({
    mutationFn: async (data: CreateIntakeFormData) => {
      try {
        // Generate a unique link for the form
        const uniqueLink = `intake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const res = await apiRequest("POST", "/api/intake-forms", {
          ...data,
          patientId: parseInt(data.patientId),
          doctorId: 1, // Use the MOCK_DOCTOR_ID from the server side
          uniqueLink,
          status: "pending" // Explicitly set status
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error("Server validation error:", errorData);
          throw new Error(errorData.message || "Failed to create intake form");
        }

        return res.json();
      } catch (error) {
        console.error("Error creating intake form:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Form created",
        description: "Patient intake form has been created and a link generated",
      });
      setCreateDialogOpen(false);
      form.reset();
      // Invalidate the query to refetch the intake forms
      queryClient.invalidateQueries({ queryKey: ["/api/intake-forms"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create form",
        description: error.message || "Check the form fields and try again",
        variant: "destructive",
      });
      console.error("Form creation error:", error);
    },
  });

  // State for preview
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [currentLink, setCurrentLink] = useState<string>("");
  const [currentFormName, setCurrentFormName] = useState<string>("");

  // State for results viewer
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);

  // Fetch results for the selected form
  const { data: formResults, isLoading: resultsLoading } = useQuery<any>({
    queryKey: [`/api/intake-forms/${selectedFormId}`],
    enabled: !!selectedFormId && isResultsOpen,
  });

  // Function to copy the intake form link to clipboard
  const copyToClipboard = (link: string) => {
    const fullLink = `${window.location.origin}/patient-join/${link}`;
    navigator.clipboard.writeText(fullLink);
    toast({
      title: "Link copied!",
      description: "The intake form link has been copied to clipboard",
    });
  };

  // Function to show link dialog
  const showLink = (link: string, name: string) => {
    setCurrentLink(`${window.location.origin}/patient-join/${link}`);
    setCurrentFormName(name);
    setShowLinkDialog(true);
  };

  // Function to open preview in new tab
  const openPreview = (link: string) => {
    window.open(`/patient-join/${link}`, '_blank');
  };

  const handleSubmit = form.handleSubmit((data) => {
    createIntakeFormMutation.mutate(data);
  });

  // Handle viewing results
  const handleViewResults = (id: number) => {
    setSelectedFormId(id);
    setIsResultsOpen(true);
  };

  // When a patient is selected, auto-fill the form fields if they exist
  const handlePatientSelect = (patientId: string) => {
    if (!patients) return;

    const selectedPatient = patients.find(p => p.id.toString() === patientId);
    if (selectedPatient) {
      form.setValue("name", `${selectedPatient.firstName} ${selectedPatient.lastName || ''}`);
      form.setValue("email", selectedPatient.email);
      form.setValue("phone", selectedPatient.phone || "");
    }
  };

  // Function to get status badge with icon
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-300",
          icon: Clock,
          label: "Pending"
        };
      case "completed":
        return {
          color: "bg-green-100 text-green-800 border-green-300",
          icon: CheckCircle,
          label: "Completed"
        };
      case "expired":
        return {
          color: "bg-red-100 text-red-800 border-red-300",
          icon: XCircle,
          label: "Expired"
        };
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-300",
          icon: Clock,
          label: status
        };
    }
  };

  // Calculate stats
  const totalForms = intakeForms?.length || 0;
  const completedForms = intakeForms?.filter(f => f.status === 'completed').length || 0;
  const pendingForms = intakeForms?.filter(f => f.status === 'pending').length || 0;

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Intake Form Link
            </DialogTitle>
            <DialogDescription>
              Share this link with {currentFormName} to complete their intake form
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Input
                value={currentLink}
                readOnly
                className="bg-white text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(currentLink);
                  toast({ title: "Copied!", description: "Link copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(currentLink, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Preview
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.open(`mailto:?subject=Patient Intake Form&body=Please complete your intake form at: ${currentLink}`, '_blank');
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send via Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Patient Intake Forms</h1>
          <p className="text-muted-foreground mt-1">
            Create, manage, and track patient intake forms
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Stats badges */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <span className="font-semibold">{totalForms}</span>
              <span>Total</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              <CheckCircle className="h-3 w-3" />
              <span className="font-semibold">{completedForms}</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
              <Clock className="h-3 w-3" />
              <span className="font-semibold">{pendingForms}</span>
            </div>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create New Intake Form
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Patient Intake Form</DialogTitle>
                <DialogDescription>
                  Create a new intake form to collect patient information.
                  A unique link will be generated that you can send to the patient.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="patientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            handlePatientSelect(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a patient" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {patients?.map((patient) => (
                              <SelectItem key={patient.id} value={patient.id.toString()}>
                                {`${patient.firstName} ${patient.lastName || ''}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createIntakeFormMutation.isPending}
                    >
                      {createIntakeFormMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Form
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {formsLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : intakeForms && intakeForms.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableCaption>List of all patient intake forms</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead>Expires On</TableHead>
                  <TableHead>Intake Link</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intakeForms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">{form.name}</TableCell>
                    <TableCell>{form.email}</TableCell>
                    <TableCell>
                      {(() => {
                        const badge = getStatusBadge(form.status);
                        const StatusIcon = badge.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {badge.label}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {format(new Date(form.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {form.expiresAt
                        ? format(new Date(form.expiresAt), "MMM d, yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(form.uniqueLink)}
                          className="gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => showLink(form.uniqueLink, form.name)}
                          title="View full link"
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewResults(form.id)}
                          disabled={form.status !== 'completed'}
                          className={cn(form.status === 'completed' ? "text-medical-dark-blue hover:text-medical-dark-blue/80" : "text-muted-foreground")}
                          title={form.status === 'completed' ? "View submitted answers" : "Wait for patient completion"}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPreview(form.uniqueLink)}
                          title="Preview form"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            window.open(`mailto:${form.email}?subject=Please Complete Your Intake Form&body=Dear ${form.name},%0D%0A%0D%0APlease complete your patient intake form at:%0D%0A${window.location.origin}/patient-join/${form.uniqueLink}%0D%0A%0D%0AThank you.`, '_blank');
                          }}
                          title="Send to patient"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold">No intake forms found</h3>
              <p className="text-muted-foreground">
                Create your first patient intake form to get started.
              </p>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Intake Form
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Results Viewer Dialog */}
      <Dialog open={isResultsOpen} onOpenChange={setIsResultsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-medical-dark-blue" />
              Intake Results: {formResults?.name}
            </DialogTitle>
            <DialogDescription>
              Submitted on {formResults?.completedAt ? format(new Date(formResults.completedAt), "PPP p") : "N/A"}
            </DialogDescription>
          </DialogHeader>

          {resultsLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* AI Summary Section */}
              {formResults?.responses?.find((r: any) => r.answerType === 'ai_summary') && (
                <Card className="bg-medical-dark-blue/5 border-medical-dark-blue/20">
                  <CardHeader className="py-3 px-4 flex flex-row items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-medical-dark-blue" />
                    <CardTitle className="text-sm font-bold uppercase text-medical-dark-blue">AI Clinical Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 px-4">
                    <p className="text-sm border-l-2 border-medical-dark-blue/30 pl-3 italic whitespace-pre-wrap">
                      {formResults.responses.find((r: any) => r.answerType === 'ai_summary').answer}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Answers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formResults?.responses?.filter((r: any) => !['ai_summary', 'transcript', 'consent', 'signature'].includes(r.answerType)).map((resp: any) => (
                  <div key={resp.id} className="border rounded-lg p-3 bg-card">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">{resp.question}</Label>
                    <p className="text-sm mt-1">{resp.answer}</p>
                  </div>
                ))}
              </div>

              {/* Full Transcript */}
              {formResults?.responses?.find((r: any) => r.answerType === 'transcript') && (
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Mic className="h-4 w-4" /> Full Voice Transcript
                  </Label>
                  <div className="bg-muted/30 rounded-md p-4 max-h-[200px] overflow-y-auto">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {formResults.responses.find((r: any) => r.answerType === 'transcript').answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResultsOpen(false)}>Close</Button>
            <Button
              className="bg-medical-dark-blue"
              onClick={() => {
                // Logic to create a medical note could be added here
                toast({ title: "Coming Soon", description: "Convert to medical note feature is under development." });
              }}
            >
              Create Medical Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}