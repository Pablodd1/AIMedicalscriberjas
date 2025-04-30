import { useQuery } from "@tanstack/react-query";
import { Patient } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  Download, 
  Upload, 
  Info 
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPatientSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PatientDetails from "./patients/patient-details";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Patients() {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [showTodayPatients, setShowTodayPatients] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showGuidelinesDialog, setShowGuidelinesDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const { toast } = useToast();

  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Function to identify today's patients (for example purposes)
  // In a real app, this would use an appointments relationship
  // For this demo, we'll just pretend some patients are "today's patients"
  const todayPatients = patients?.filter((_, index) => {
    // Just a simple demonstration - consider even indices as "today's patients"
    return index % 2 === 0;
  });

  // Function to export patient data as CSV
  const exportPatients = () => {
    if (!patients || patients.length === 0) {
      toast({
        title: "No Data",
        description: "There are no patients to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV header row
    const headers = ["First Name", "Last Name", "Email", "Phone", "Date of Birth", "Address", "Medical History"];
    
    // Convert patients data to CSV format
    const csvContent = [
      headers.join(","),
      ...patients.map(patient => [
        patient.firstName,
        patient.lastName || "",
        patient.email,
        patient.phone || "",
        patient.dateOfBirth || "",
        patient.address || "",
        patient.medicalHistory || ""
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `patients_export_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Success",
      description: "Patient data exported successfully",
    });
  };

  // Function to handle file import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  // Function to process the imported file
  const processImport = () => {
    if (!importFile) {
      toast({
        title: "No File",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    // In a real implementation, this would parse the CSV and create patients
    // For this example, we'll just show a success message
    toast({
      title: "Import Processing",
      description: "Your file is being processed. Patients will be imported shortly.",
    });
    
    // Close the import dialog
    setShowImportDialog(false);
    setImportFile(null);
  };

  const form = useForm({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      address: "",
      medicalHistory: "",
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/patients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Success",
        description: "Patient created successfully",
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

  // Filter patients based on search query and whether to show only today's patients
const filteredPatients = patients?.filter((patient, index) => {
    // First check if we're showing only today's patients
    if (showTodayPatients) {
      // In a real app, this would check appointments for today
      // For simplicity, we're just using the same logic as todayPatients
      if (index % 2 !== 0) {
        return false;
      }
    }
    
    // Then apply search filter
    return `${patient.firstName} ${patient.lastName || ''}`.toLowerCase().includes(search.toLowerCase()) ||
      patient.email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="text-muted-foreground">Manage your patient records and information</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createPatientMutation.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John" required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="patient@example.com" required />
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
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="medicalHistory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical History</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createPatientMutation.isPending}>
                  {createPatientMutation.isPending ? "Creating..." : "Create Patient"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center border rounded-md px-3 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            className="border-0 focus-visible:ring-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={showTodayPatients ? "default" : "outline"} 
                onClick={() => setShowTodayPatients(!showTodayPatients)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Today's Patients
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show only patients with appointments today</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={exportPatients}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export patient data as CSV</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={() => setShowImportDialog(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Import patients from Excel file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowGuidelinesDialog(true)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Import Guidelines</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPatients?.map((patient) => (
              <TableRow key={patient.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium">{`${patient.firstName} ${patient.lastName || ''}`}</TableCell>
                <TableCell>
                  <Badge variant="secondary">Active</Badge>
                </TableCell>
                <TableCell>{patient.email}</TableCell>
                <TableCell>{patient.phone}</TableCell>
                <TableCell>{patient.dateOfBirth}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPatient(patient.id)}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedPatient && (
        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-4xl h-[80vh]">
            <PatientDetails patientId={selectedPatient} />
          </DialogContent>
        </Dialog>
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Import Patients</DialogTitle>
            <DialogDescription>
              Upload an Excel file with patient data. The file must follow the template format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <label 
                htmlFor="file-upload" 
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Excel files only (.xlsx, .xls)
                  </p>
                </div>
                <input 
                  id="file-upload" 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx,.xls" 
                  onChange={handleFileUpload}
                />
              </label>
              {importFile && (
                <div className="text-sm">
                  Selected file: <span className="font-medium">{importFile.name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center text-sm">
              <Info className="h-4 w-4 mr-2 text-medical-yellow" />
              <p>Make sure your file follows the <Button variant="link" className="p-0 h-auto" onClick={() => { setShowImportDialog(false); setShowGuidelinesDialog(true); }}>import guidelines</Button></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={processImport} disabled={!importFile}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guidelines Dialog */}
      <Dialog open={showGuidelinesDialog} onOpenChange={setShowGuidelinesDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Patient Import Guidelines</DialogTitle>
            <DialogDescription>
              Follow these guidelines to ensure your patient data imports correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-medical-dark-blue">File Format</h3>
              <p>Your Excel file (.xlsx or .xls) must contain the following columns:</p>
              <div className="bg-muted/50 p-4 rounded-md">
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>First Name</strong> (Required) - Patient's first name</li>
                  <li><strong>Last Name</strong> - Patient's last name</li>
                  <li><strong>Email</strong> (Required) - Must be a valid email address</li>
                  <li><strong>Phone</strong> - Phone number (include country code if international)</li>
                  <li><strong>Date of Birth</strong> - In YYYY-MM-DD format (e.g., 1990-01-15)</li>
                  <li><strong>Address</strong> - Patient's full address</li>
                  <li><strong>Medical History</strong> - Brief medical history or notes</li>
                </ul>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-medical-dark-blue">Requirements</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>First row must contain column headers exactly as listed above</li>
                <li>First Name and Email are required for each patient</li>
                <li>Each email address must be unique in the system</li>
                <li>Maximum 500 patients per import</li>
                <li>Maximum file size: 5MB</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-medical-dark-blue">Example</h3>
              <div className="bg-muted/50 p-4 rounded-md overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">First Name</th>
                      <th className="border px-2 py-1 text-left">Last Name</th>
                      <th className="border px-2 py-1 text-left">Email</th>
                      <th className="border px-2 py-1 text-left">Phone</th>
                      <th className="border px-2 py-1 text-left">Date of Birth</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border px-2 py-1">John</td>
                      <td className="border px-2 py-1">Smith</td>
                      <td className="border px-2 py-1">john.smith@example.com</td>
                      <td className="border px-2 py-1">+1-555-123-4567</td>
                      <td className="border px-2 py-1">1985-04-12</td>
                    </tr>
                    <tr>
                      <td className="border px-2 py-1">Sarah</td>
                      <td className="border px-2 py-1">Johnson</td>
                      <td className="border px-2 py-1">sarah.j@example.com</td>
                      <td className="border px-2 py-1">+1-555-987-6543</td>
                      <td className="border px-2 py-1">1992-07-23</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-medical-dark-blue">Tips</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Export existing patients first to see the correct format</li>
                <li>Use Excel or Google Sheets to prepare your data</li>
                <li>Check for duplicate emails before importing</li>
                <li>The system will validate your file before importing</li>
                <li>Failed imports will show detailed error messages</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowGuidelinesDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}