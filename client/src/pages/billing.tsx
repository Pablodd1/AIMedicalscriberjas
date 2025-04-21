import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarIcon, Plus, DollarSign, FileText, CreditCard, Calendar, Edit, FileCheck, Pencil, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Patient, Invoice } from "@shared/schema";
import { format } from "date-fns";

// Extended interface for invoices with patient data
interface ExtendedInvoice extends Invoice {
  patient?: {
    id: number;
    firstName: string;
    lastName: string | null;
    email: string;
  }
}
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";

// Form schema for creating a new invoice
const invoiceFormSchema = z.object({
  patientId: z.coerce.number().min(1, "Please select a patient"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  amountPaid: z.coerce.number().min(0, "Amount paid cannot be negative").optional(),
  description: z.string().min(5, "Description must be at least 5 characters"),
  dueDate: z.union([
    z.string().min(1, "Please select a due date"),
    z.date({ required_error: "Please select a due date" })
  ]),
  invoiceNumber: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

// Form schema for updating payment
const paymentFormSchema = z.object({
  amountPaid: z.coerce.number().min(0, "Amount paid cannot be negative"),
  status: z.enum(["paid", "partial", "unpaid", "overdue"]),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export default function Billing() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ExtendedInvoice | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  // Fetch invoices
  const { data: invoices, isLoading: isLoadingInvoices } = useQuery<ExtendedInvoice[]>({
    queryKey: ['/api/invoices'],
  });
  
  // Fetch patients for the dropdown
  const { data: patients, isLoading: isLoadingPatients } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });
  
  // Form setup for creating a new invoice
  const invoiceForm = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      amount: 0,
      amountPaid: 0,
      description: "",
    },
  });
  
  // Form setup for updating payment
  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amountPaid: 0,
      status: "unpaid",
    },
  });
  
  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      // Generate invoice number if not provided
      const invoiceNumber = `INV-${new Date().toISOString().slice(0,10)}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Use simple date format as a string
      let dueDate = data.dueDate;
      // Convert date object to string if needed
      let dueDateStr = '';
      if (typeof dueDate === 'object' && dueDate instanceof Date) {
        // Convert to YYYY-MM-DD format
        dueDateStr = dueDate.toISOString().split('T')[0];
      } else {
        dueDateStr = String(dueDate);
      }
      
      const res = await apiRequest("POST", "/api/invoices", {
        ...data,
        doctorId: user?.id, // Explicitly add the doctor ID from the logged-in user
        // Convert amount to cents
        amount: Math.round(data.amount * 100),
        amountPaid: Math.round((data.amountPaid || 0) * 100),
        // Use a simple date string format
        dueDate: dueDateStr,
        // Add the invoice number
        invoiceNumber,
        // Add status if not provided
        status: data.amountPaid && data.amountPaid >= data.amount ? 'paid' : data.amountPaid ? 'partial' : 'unpaid',
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Invoice created",
        description: "The invoice has been created successfully.",
      });
      setShowNewInvoiceForm(false);
      invoiceForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (data: { id: number, amountPaid: number }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${data.id}/payment`, {
        // Convert amount to cents
        amountPaid: Math.round(data.amountPaid * 100),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Payment updated",
        description: "The payment has been updated successfully.",
      });
      setShowPaymentDialog(false);
      setSelectedInvoice(null);
      paymentForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: number, status: string }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${data.id}/status`, {
        status: data.status,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Status updated",
        description: "The invoice status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Submit handler for new invoice form
  const onSubmitNewInvoice = (data: InvoiceFormValues) => {
    createInvoiceMutation.mutate(data);
  };
  
  // Submit handler for payment form
  const onSubmitPayment = (data: PaymentFormValues) => {
    if (selectedInvoice) {
      updatePaymentMutation.mutate({
        id: selectedInvoice.id,
        amountPaid: data.amountPaid,
      });
    }
  };
  
  // Open payment dialog for an invoice
  const handleUpdatePayment = (invoice: ExtendedInvoice) => {
    setSelectedInvoice(invoice);
    paymentForm.reset({
      // Convert cents to dollars for display
      amountPaid: invoice.amountPaid / 100,
      status: invoice.status as any,
    });
    setShowPaymentDialog(true);
  };
  
  // Calculate metrics for the summary cards
  const totalRevenue = invoices?.reduce((sum, invoice) => sum + invoice.amountPaid, 0) || 0;
  const pendingPayments = invoices?.filter(invoice => invoice.status === "unpaid" || invoice.status === "partial").length || 0;
  const outstandingAmount = invoices?.reduce((sum, invoice) => {
    const remaining = invoice.amount - invoice.amountPaid;
    return sum + (remaining > 0 ? remaining : 0);
  }, 0) || 0;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Billing & Invoices</h1>
          <p className="text-muted-foreground">Manage payments and invoices</p>
        </div>
        <Button onClick={() => setShowNewInvoiceForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total payments received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments}</div>
            <p className="text-xs text-muted-foreground">Unpaid or partially paid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(outstandingAmount / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total amount remaining</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingInvoices ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : !invoices || invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      No invoices found. Create a new invoice to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => {
                    const remaining = invoice.amount - invoice.amountPaid;
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName || ''}` : `Patient #${invoice.patientId}`}</TableCell>
                        <TableCell>${(invoice.amount / 100).toFixed(2)}</TableCell>
                        <TableCell>${(invoice.amountPaid / 100).toFixed(2)}</TableCell>
                        <TableCell>${(remaining / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === "paid"
                                ? "secondary"
                                : invoice.status === "partial"
                                ? "default"
                                : invoice.status === "unpaid"
                                ? "outline"
                                : "destructive"
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleUpdatePayment(invoice)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showNewInvoiceForm} onOpenChange={setShowNewInvoiceForm}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>
              Create a new invoice for a patient. All amounts are in dollars.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...invoiceForm}>
            <form onSubmit={invoiceForm.handleSubmit(onSubmitNewInvoice)} className="space-y-4">
              <FormField
                control={invoiceForm.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value?.toString()}>
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
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={invoiceForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={invoiceForm.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Paid ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={invoiceForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={invoiceForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            {field.value ? (
                              typeof field.value === 'string' 
                                ? format(new Date(field.value), "PPP") 
                                : format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={
                            field.value ? 
                              (typeof field.value === 'string' ? 
                                new Date(field.value) : 
                                field.value as Date) 
                              : undefined
                          }
                          onSelect={(date) => {
                            // Store as a YYYY-MM-DD string instead of a Date object
                            if (date) {
                              // Convert to string in YYYY-MM-DD format
                              const dateStr = date.toISOString().split('T')[0];
                              field.onChange(dateStr);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowNewInvoiceForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createInvoiceMutation.isPending}>
                  {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Update Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Payment</DialogTitle>
            <DialogDescription>
              Update the payment status for invoice {selectedInvoice?.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Invoice Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Patient:</p>
                      <p>{selectedInvoice.patient ? `${selectedInvoice.patient.firstName} ${selectedInvoice.patient.lastName || ''}` : `Patient #${selectedInvoice.patientId}`}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Amount:</p>
                      <p>${(selectedInvoice.amount / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Due Date:</p>
                      <p>{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current Status:</p>
                      <Badge
                        variant={
                          selectedInvoice.status === "paid"
                            ? "secondary"
                            : selectedInvoice.status === "partial"
                            ? "default"
                            : selectedInvoice.status === "unpaid"
                            ? "outline"
                            : "destructive"
                        }
                      >
                        {selectedInvoice.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <FormField
                  control={paymentForm.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Paid ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>
                        Enter the total amount that has been paid so far.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={paymentForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowPaymentDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updatePaymentMutation.isPending}>
                    {updatePaymentMutation.isPending ? "Updating..." : "Update Payment"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}