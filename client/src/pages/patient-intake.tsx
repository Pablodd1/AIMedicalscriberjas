import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash, Send } from "lucide-react";
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
    name: string;
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
      // Generate a unique link for the form
      const uniqueLink = `intake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const res = await apiRequest("POST", "/api/intake-forms", {
        ...data,
        patientId: parseInt(data.patientId),
        doctorId: 1, // Use the MOCK_DOCTOR_ID from the server side
        uniqueLink,
      });
      return res.json();
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to copy the intake form link to clipboard
  const copyToClipboard = (link: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/patient-join/${link}`);
    toast({
      title: "Link copied",
      description: "The intake form link has been copied to clipboard",
    });
  };

  const handleSubmit = form.handleSubmit((data) => {
    createIntakeFormMutation.mutate(data);
  });

  // When a patient is selected, auto-fill the form fields if they exist
  const handlePatientSelect = (patientId: string) => {
    if (!patients) return;
    
    const selectedPatient = patients.find(p => p.id.toString() === patientId);
    if (selectedPatient) {
      form.setValue("name", selectedPatient.name);
      form.setValue("email", selectedPatient.email);
      form.setValue("phone", selectedPatient.phone || "");
    }
  };

  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "expired":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Patient Intake Forms</h1>
          <p className="text-muted-foreground mt-1">
            Create, manage, and track patient intake forms
          </p>
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
                              {patient.name}
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(form.status)}`}>
                        {form.status}
                      </span>
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(form.uniqueLink)}
                      >
                        Copy Link
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="ml-2"
                        // This would be implemented later for viewing form responses
                        onClick={() => {
                          window.location.href = `/patient-intake/${form.id}`;
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
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
    </div>
  );
}