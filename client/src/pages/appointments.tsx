import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { Appointment, Patient, insertAppointmentSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Mail, Calendar as CalendarIcon2, CheckCircle, XCircle, Clock, ClipboardCheck, Download, GripVertical, RefreshCw } from "lucide-react";
import * as XLSX from 'xlsx';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isWithinInterval, getDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Appointments() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [customStatus, setCustomStatus] = useState("");
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [editPatientSearchOpen, setEditPatientSearchOpen] = useState(false);
  const [showDayAppointments, setShowDayAppointments] = useState(false);
  const [isPatientListDialogOpen, setIsPatientListDialogOpen] = useState(false);
  const [patientListDate, setPatientListDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [doctorEmail, setDoctorEmail] = useState("");
  const [filteredStatus, setFilteredStatus] = useState<string | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchDate, setSearchDate] = useState<Date | undefined>(undefined);
  const [searchStatus, setSearchStatus] = useState<string>("all");
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<Date | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<{appointment: Appointment, newDate: Date} | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<{hour: string, minute: string}>({hour: "9", minute: "0"});

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch saved doctor email from settings
  const { data: emailSettings } = useQuery<{ doctorEmail?: string }>({
    queryKey: ["/api/settings"],
    select: (data: any) => {
      // Extract doctorEmail from settings array
      if (Array.isArray(data)) {
        const emailSetting = data.find((s: any) => s.key === 'doctorEmail');
        return { doctorEmail: emailSetting?.value || '' };
      }
      return { doctorEmail: data?.doctorEmail || '' };
    }
  });

  // Set doctor email when loaded from settings
  React.useEffect(() => {
    if (emailSettings?.doctorEmail && !doctorEmail) {
      setDoctorEmail(emailSettings.doctorEmail);
    }
  }, [emailSettings]);

  const validationSchema = insertAppointmentSchema.extend({
    patientId: insertAppointmentSchema.shape.patientId.refine(
      (value) => value > 0, 
      { message: "Please select a patient" }
    ),
    // Allow the date to be a number (timestamp)
    date: z.union([
      z.date(),
      z.string().transform((str) => new Date(str)),
      z.number().transform((num) => new Date(num))
    ])
  });

  const form = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      patientId: 0,
      doctorId: 1, // Using a default doctor ID for now
      date: (() => {
        const now = new Date();
        now.setHours(9, 0, 0, 0); // Default to 9:00 AM
        return now.getTime();
      })(),
      notes: "",
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Initialize form when editing an appointment
  React.useEffect(() => {
    if (editingAppointment && isEditDialogOpen) {
      form.reset({
        patientId: editingAppointment.patientId,
        doctorId: editingAppointment.doctorId,
        date: new Date(editingAppointment.date).getTime(),
        notes: editingAppointment.notes || '',
      });
    }
  }, [editingAppointment, isEditDialogOpen]);

  // Helper functions for calendar view
  const navigateMonth = (direction: 'next' | 'prev') => {
    setCurrentMonth(direction === 'next' 
      ? addMonths(currentMonth, 1) 
      : subMonths(currentMonth, 1)
    );
  };

  const getDaysInMonth = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get appointments for selected date
    const getAppointmentsForDate = (date: Date) => {
      if (!appointments) return [];
      return appointments.filter(appointment => {
        const appointmentDate = new Date(appointment.date);
        return isSameDay(appointmentDate, date);
      });
    };

    return days.map(day => ({
      date: day,
      isToday: isToday(day),
      appointments: getAppointmentsForDate(day)
    }));
  };

  const days = getDaysInMonth();

  const updateAppointmentStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await apiRequest("PATCH", `/api/appointments/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Success",
        description: "Appointment status updated",
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

  const updateAppointmentStatus = (id: number, status: string) => {
    updateAppointmentStatusMutation.mutate({ id, status });
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      // First convert the date string to a Date object if it's not already
      const dateObj = typeof data.date === 'string' ? new Date(data.date) : data.date;

      // Convert the date to a timestamp (number)
      const formattedData = {
        ...data,
        date: dateObj.getTime(),
      };

      const res = await apiRequest("POST", "/api/appointments", formattedData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Success",
        description: "Appointment created successfully",
      });
      // Close the dialog and reset form
      setIsDialogOpen(false);
      form.reset({
        patientId: 0,
        doctorId: 1,
        date: (() => {
          const now = new Date();
          now.setHours(9, 0, 0, 0);
          return now.getTime();
        })(),
        notes: "",
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

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const dateObj = typeof data.date === 'string' ? new Date(data.date) : data.date;
      const formattedData = {
        ...data,
        date: dateObj.getTime(),
      };
      const res = await apiRequest("PUT", `/api/appointments/${id}`, formattedData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Success",
        description: "Appointment updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingAppointment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/appointments/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Success",
        description: "Appointment deleted successfully",
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

  const sendPatientListMutation = useMutation({
    mutationFn: async ({ date, email }: { date: Date, email: string }) => {
      // Use fetch directly to handle both success and failure cases
      const res = await fetch("/api/settings/send-patient-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date.toISOString(),
          doctorEmail: email,
        }),
        credentials: "include",
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to send: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.success === false) {
        // No appointments found for date
        toast({
          title: "No Appointments",
          description: data.message,
          variant: "default",
        });
      } else {
        // Email sent successfully
        toast({
          title: "Email Sent!",
          description: data.message || "Patient list sent successfully",
        });
        setIsPatientListDialogOpen(false);
      }
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast({
        title: "Failed to Send",
        description: error.message || "An error occurred while sending the email",
        variant: "destructive",
      });
    },
  });

  // Download appointments by status
  const downloadAppointmentsByStatus = (status: string | null) => {
    const appointmentsToExport = status === null 
      ? appointments || []
      : appointments?.filter(apt => apt.status === status) || [];

    if (appointmentsToExport.length === 0) {
      toast({
        title: "No Appointments",
        description: `No ${status || 'all'} appointments found to export.`,
        variant: "default",
      });
      return;
    }

    // Prepare data for Excel
    const exportData = appointmentsToExport.map(apt => {
      const patient = patients?.find(p => p.id === apt.patientId);
      return {
        'Patient Name': patient ? `${patient.firstName} ${patient.lastName || ''}` : '',
        'Patient Email': patient?.email || '',
        'Date': new Date(apt.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        'Time': new Date(apt.date).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }),
        'Status': apt.status.charAt(0).toUpperCase() + apt.status.slice(1),
        'Patient Confirmation': (apt as any).patientConfirmationStatus || 'pending_confirmation',
        'Notes': apt.notes || '',
      };
    });

    // Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Appointments");

    // Download file
    const fileName = status === null 
      ? `All_Appointments_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.xlsx`
      : `${status.charAt(0).toUpperCase() + status.slice(1)}_Appointments_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Download Complete",
      description: `Downloaded ${appointmentsToExport.length} appointment(s)`,
    });
  };

  // Show filtered appointments dialog
  const showFilteredAppointments = (status: string | null) => {
    setFilteredStatus(status);
    setIsStatusDialogOpen(true);
  };

  // Get filtered appointments
  const getFilteredAppointments = () => {
    if (filteredStatus === null) {
      return appointments || [];
    }
    return appointments?.filter(apt => apt.status === filteredStatus) || [];
  };

  // Filter appointments for list view based on search criteria
  const getSearchFilteredAppointments = () => {
    if (!appointments) return [];
    
    return appointments.filter(apt => {
      const patient = patients?.find(p => p.id === apt.patientId);
      const patientName = patient ? `${patient.firstName} ${patient.lastName || ''}`.toLowerCase() : '';
      const patientEmail = patient?.email?.toLowerCase() || '';
      
      // Name filter
      if (searchName && !patientName.includes(searchName.toLowerCase())) {
        return false;
      }
      
      // Email filter
      if (searchEmail && !patientEmail.includes(searchEmail.toLowerCase())) {
        return false;
      }
      
      // Date filter
      if (searchDate) {
        const aptDate = new Date(apt.date);
        const searchDateOnly = new Date(searchDate);
        searchDateOnly.setHours(0, 0, 0, 0);
        aptDate.setHours(0, 0, 0, 0);
        if (aptDate.getTime() !== searchDateOnly.getTime()) {
          return false;
        }
      }
      
      // Status filter
      if (searchStatus !== "all" && apt.status !== searchStatus) {
        return false;
      }
      
      return true;
    });
  };

  // Clear search filters
  const clearSearch = () => {
    setSearchName("");
    setSearchEmail("");
    setSearchDate(undefined);
    setSearchStatus("all");
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id.toString());
    // Add a visual indicator
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedAppointment(null);
    setDropTargetDate(null);
  };

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetDate(date);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setDropTargetDate(null);
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDropTargetDate(null);
    
    if (draggedAppointment) {
      // Show reschedule dialog with time selection
      setRescheduleTarget({appointment: draggedAppointment, newDate: targetDate});
      // Set initial time to the original appointment time
      const originalDate = new Date(draggedAppointment.date);
      setRescheduleTime({
        hour: originalDate.getHours().toString(),
        minute: originalDate.getMinutes().toString()
      });
      setShowRescheduleDialog(true);
    }
    
    setDraggedAppointment(null);
  };

  const confirmReschedule = () => {
    if (!rescheduleTarget) return;
    
    const newDateTime = new Date(rescheduleTarget.newDate);
    newDateTime.setHours(parseInt(rescheduleTime.hour), parseInt(rescheduleTime.minute), 0, 0);
    
    // Update the appointment
    updateAppointmentMutation.mutate({
      id: rescheduleTarget.appointment.id,
      data: {
        ...rescheduleTarget.appointment,
        date: newDateTime.getTime(),
        status: 'rescheduled'
      }
    });
    
    setShowRescheduleDialog(false);
    setRescheduleTarget(null);
    toast({
      title: "Appointment Rescheduled",
      description: `Appointment moved to ${format(newDateTime, 'PPP')} at ${format(newDateTime, 'p')}`,
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Appointments</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Dialog open={isPatientListDialogOpen} onOpenChange={setIsPatientListDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-send-patient-list" className="w-full sm:w-auto">
                <Mail className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Send Patient List to Doctor</span>
                <span className="sm:hidden">Patient List</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Patient List to Doctor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Date</label>
                  <Calendar
                    mode="single"
                    selected={patientListDate}
                    onSelect={(date) => date && setPatientListDate(date)}
                    className="rounded-md border"
                    data-testid="calendar-select-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Doctor Email</label>
                  <Input
                    type="email"
                    placeholder="doctor@example.com"
                    value={doctorEmail}
                    onChange={(e) => setDoctorEmail(e.target.value)}
                    data-testid="input-doctor-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    This email will be saved for future use
                  </p>
                </div>
                <Button
                  onClick={() => {
                    if (!doctorEmail) {
                      toast({
                        title: "Error",
                        description: "Please enter a doctor email",
                        variant: "destructive",
                      });
                      return;
                    }
                    sendPatientListMutation.mutate({ 
                      date: patientListDate, 
                      email: doctorEmail 
                    });
                  }}
                  disabled={sendPatientListMutation.isPending}
                  className="w-full"
                  data-testid="button-send-email"
                >
                  {sendPatientListMutation.isPending ? "Sending..." : "Send Patient List"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule New Appointment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createAppointmentMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Patient</FormLabel>
                      <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? (() => {
                                    const patient = patients?.find((p) => p.id === field.value);
                                    return patient
                                      ? `${patient.firstName} ${patient.lastName || ''} (${patient.email})`
                                      : "Select patient";
                                  })()
                                : "Select patient"}
                              <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[90vw] sm:w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="Search patients..." />
                            <CommandList>
                              <CommandEmpty>No patient found.</CommandEmpty>
                              <CommandGroup>
                                {patients?.map((patient) => (
                                  <CommandItem
                                    key={patient.id}
                                    value={`${patient.firstName} ${patient.lastName} ${patient.email}`}
                                    onSelect={() => {
                                      field.onChange(patient.id);
                                      setPatientSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        patient.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date & Time</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP p")
                              ) : (
                                <span>Pick a date and time</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // Preserve the time when selecting a new date
                                const currentDate = field.value ? new Date(field.value) : new Date();
                                date.setHours(currentDate.getHours());
                                date.setMinutes(currentDate.getMinutes());
                                field.onChange(date.getTime());
                              }
                            }}
                            disabled={(date) =>
                              date < new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <div className="flex items-center gap-2">
                              <Select 
                                value={field.value ? new Date(field.value).getHours().toString() : "9"}
                                onValueChange={(hour) => {
                                  const date = field.value ? new Date(field.value) : new Date();
                                  date.setHours(parseInt(hour));
                                  field.onChange(date.getTime());
                                }}
                              >
                                <SelectTrigger className="w-[70px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {i.toString().padStart(2, '0')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-sm">:</span>
                              <Select 
                                value={field.value ? new Date(field.value).getMinutes().toString() : "0"}
                                onValueChange={(minute) => {
                                  const date = field.value ? new Date(field.value) : new Date();
                                  date.setMinutes(parseInt(minute));
                                  field.onChange(date.getTime());
                                }}
                              >
                                <SelectTrigger className="w-[70px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[0, 15, 30, 45].map((minute) => (
                                    <SelectItem key={minute} value={minute.toString()}>
                                      {minute.toString().padStart(2, '0')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Add appointment notes..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createAppointmentMutation.isPending}>
                  {createAppointmentMutation.isPending ? "Scheduling..." : "Schedule Appointment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full" onValueChange={(value) => setViewMode(value as "list" | "calendar")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {/* Search/Filter Section */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Search Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mini Appointment Reports Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                <Card 
                  className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-blue-500 to-blue-600 border-blue-300"
                  onClick={() => showFilteredAppointments("scheduled")}
                  data-testid="mini-card-scheduled"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <CalendarIcon2 className="h-3 w-3 text-white" />
                      <span className="text-white text-xs font-medium">Scheduled</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {appointments?.filter(apt => apt.status === "scheduled").length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-red-500 to-red-600 border-red-300"
                  onClick={() => showFilteredAppointments("cancelled")}
                  data-testid="mini-card-cancelled"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <XCircle className="h-3 w-3 text-white" />
                      <span className="text-white text-xs font-medium">Cancelled</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {appointments?.filter(apt => apt.status === "cancelled").length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-green-500 to-green-600 border-green-300"
                  onClick={() => showFilteredAppointments("completed")}
                  data-testid="mini-card-complete"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle className="h-3 w-3 text-white" />
                      <span className="text-white text-xs font-medium">Complete</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {appointments?.filter(apt => apt.status === "completed").length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-orange-500 to-orange-600 border-orange-300"
                  onClick={() => showFilteredAppointments("pending")}
                  data-testid="mini-card-pending"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="h-3 w-3 text-white" />
                      <span className="text-white text-xs font-medium">Pending</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {appointments?.filter(apt => apt.status === "pending").length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-all bg-gradient-to-br from-purple-500 to-purple-600 border-purple-300"
                  onClick={() => showFilteredAppointments(null)}
                  data-testid="mini-card-all"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <ClipboardCheck className="h-3 w-3 text-white" />
                      <span className="text-white text-xs font-medium">All</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {appointments?.length || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="Enter name"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    data-testid="input-search-name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    placeholder="Enter email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    data-testid="input-search-email"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !searchDate && "text-muted-foreground"
                        )}
                        data-testid="button-search-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {searchDate ? format(searchDate, "MM/dd/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={searchDate}
                        onSelect={setSearchDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={searchStatus} onValueChange={setSearchStatus}>
                    <SelectTrigger data-testid="select-search-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Complete</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={clearSearch} 
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  data-testid="button-clear-search"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {getSearchFilteredAppointments().length === 0 ? (
              <div className="text-center p-6 border rounded-lg">
                <p className="text-muted-foreground">
                  {appointments?.length === 0 
                    ? "No appointments scheduled." 
                    : "No appointments found matching your search criteria."}
                </p>
              </div>
            ) : (
              getSearchFilteredAppointments().map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {(() => {
                        const patient = patients?.find(p => p.id === appointment.patientId);
                        return patient ? `${patient.firstName} ${patient.lastName || ''}` : '';
                      })()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(appointment.date), "PPP p")}
                    </p>
                    {appointment.notes && (
                      <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant={
                        (appointment as any).patientConfirmationStatus === "confirmed" ? "default" : 
                        (appointment as any).patientConfirmationStatus === "pending_confirmation" ? "secondary" : 
                        (appointment as any).patientConfirmationStatus === "declined" ? "destructive" : 
                        "secondary"
                      } className={cn("text-xs",
                        (appointment as any).patientConfirmationStatus === "confirmed" && "bg-green-500 hover:bg-green-600 text-white",
                        (appointment as any).patientConfirmationStatus === "pending_confirmation" && "bg-orange-500 hover:bg-orange-600 text-white",
                        (appointment as any).patientConfirmationStatus === "declined" && "bg-red-500 hover:bg-red-600 text-white"
                      )}>
                        Patient Confirmation: {(appointment as any).patientConfirmationStatus === "pending_confirmation" ? "Pending" : 
                                 (appointment as any).patientConfirmationStatus === "confirmed" ? "Confirmed" : 
                                 (appointment as any).patientConfirmationStatus === "declined" ? "Declined" : 
                                 (appointment as any).patientConfirmationStatus || 'Pending'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditingAppointment(appointment);
                        setIsEditDialogOpen(true);
                      }}
                      data-testid={`button-edit-appointment-${appointment.id}`}
                      className="flex-1 sm:flex-initial"
                    >
                      <Edit2 className="h-4 w-4 sm:mr-0" />
                      <span className="sm:hidden ml-2">Edit</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this appointment?')) {
                          deleteAppointmentMutation.mutate(appointment.id);
                        }
                      }}
                      data-testid={`button-delete-appointment-${appointment.id}`}
                      className="flex-1 sm:flex-initial"
                    >
                      <Trash2 className="h-4 w-4 sm:mr-0" />
                      <span className="sm:hidden ml-2">Delete</span>
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          <Badge variant={
                            appointment.status === "scheduled" ? "outline" : 
                            appointment.status === "completed" ? "default" : 
                            appointment.status === "cancelled" ? "destructive" : 
                            "secondary"
                          } className="mr-2">
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </Badge>
                          <span className="hidden sm:inline">Appointment Status</span>
                          <span className="sm:hidden">Status</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[90vw] sm:w-80" align="end">
                        <div className="space-y-4">
                          <h4 className="font-medium">Update Appointment Status</h4>
                          <p className="text-xs text-muted-foreground">This is your internal appointment status (not patient confirmation)</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "scheduled")}
                            >
                              Scheduled
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "completed")}
                            >
                              Completed
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "cancelled")}
                            >
                              Cancelled
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "rescheduled")}
                            >
                              Rescheduled
                            </Button>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Custom Status:</label>
                            <div className="flex mt-1 gap-2">
                              <Input 
                                placeholder="Enter custom status"
                                value={customStatus}
                                onChange={(e) => setCustomStatus(e.target.value)}
                                className="h-8"
                              />
                              <Button 
                                size="sm"
                                disabled={!customStatus}
                                onClick={() => {
                                  if (customStatus) {
                                    updateAppointmentStatus(appointment.id, customStatus);
                                    setCustomStatus("");
                                  }
                                }}
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          {/* Appointment Status Summary */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Appointment Reports</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {/* Scheduled */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-to-br from-blue-500 to-blue-600 border-blue-300"
                onClick={() => showFilteredAppointments("scheduled")}
                data-testid="card-scheduled"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon2 className="h-5 w-5 text-white" />
                    <CardTitle className="text-white text-sm md:text-base">Scheduled</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-white mb-3">
                    {appointments?.filter(apt => apt.status === "scheduled").length || 0}
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-xs bg-white hover:bg-gray-100 text-blue-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAppointmentsByStatus("scheduled");
                    }}
                    data-testid="button-download-scheduled"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </CardContent>
              </Card>

              {/* Cancelled */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-to-br from-red-500 to-red-600 border-red-300"
                onClick={() => showFilteredAppointments("cancelled")}
                data-testid="card-cancelled"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-white" />
                    <CardTitle className="text-white text-sm md:text-base">Cancelled</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-white mb-3">
                    {appointments?.filter(apt => apt.status === "cancelled").length || 0}
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-xs bg-white hover:bg-gray-100 text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAppointmentsByStatus("cancelled");
                    }}
                    data-testid="button-download-cancelled"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </CardContent>
              </Card>

              {/* Complete */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-to-br from-green-500 to-green-600 border-green-300"
                onClick={() => showFilteredAppointments("completed")}
                data-testid="card-complete"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-white" />
                    <CardTitle className="text-white text-sm md:text-base">Complete</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-white mb-3">
                    {appointments?.filter(apt => apt.status === "completed").length || 0}
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-xs bg-white hover:bg-gray-100 text-green-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAppointmentsByStatus("completed");
                    }}
                    data-testid="button-download-complete"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </CardContent>
              </Card>

              {/* Pending */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-to-br from-orange-500 to-orange-600 border-orange-300"
                onClick={() => showFilteredAppointments("pending")}
                data-testid="card-pending"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-white" />
                    <CardTitle className="text-white text-sm md:text-base">Pending</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-white mb-3">
                    {appointments?.filter(apt => apt.status === "pending").length || 0}
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-xs bg-white hover:bg-gray-100 text-orange-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAppointmentsByStatus("pending");
                    }}
                    data-testid="button-download-pending"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </CardContent>
              </Card>

              {/* All */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-to-br from-purple-500 to-purple-600 border-purple-300"
                onClick={() => showFilteredAppointments(null)}
                data-testid="card-all"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-white" />
                    <CardTitle className="text-white text-sm md:text-base">All</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-white mb-3">
                    {appointments?.length || 0}
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-xs bg-white hover:bg-gray-100 text-purple-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAppointmentsByStatus(null);
                    }}
                    data-testid="button-download-all"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 md:p-4 border-b">
              <div className="flex flex-col gap-1">
                <h3 className="font-medium text-sm md:text-base">{format(currentMonth, 'MMMM yyyy')}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  <span>Drag appointments to reschedule</span>
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')} className="h-8 w-8 md:h-10 md:w-10">
                  <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigateMonth('next')} className="h-8 w-8 md:h-10 md:w-10">
                  <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <div key={day} className="py-1 md:py-2 font-medium text-[10px] md:text-xs">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: getDay(days[0].date) }).map((_, index) => (
                <div 
                  key={`empty-${index}`} 
                  className="h-16 md:h-24 border-t border-r p-0.5 md:p-1 bg-gray-50"
                  onDragOver={(e) => e.preventDefault()}
                ></div>
              ))}

              {days.map((day, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-16 md:h-24 border-t border-r p-0.5 md:p-1 cursor-pointer hover:bg-gray-50 transition-all duration-200",
                    day.isToday && "bg-blue-50",
                    selectedDate && isSameDay(day.date, selectedDate) && "ring-2 ring-blue-500",
                    dropTargetDate && isSameDay(day.date, dropTargetDate) && "bg-green-100 ring-2 ring-green-500 ring-dashed",
                    "relative overflow-hidden"
                  )}
                  onClick={() => {
                    setSelectedDate(day.date);
                    if (day.appointments.length > 0) {
                      setShowDayAppointments(true);
                    }
                  }}
                  onDragOver={(e) => handleDragOver(e, day.date)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day.date)}
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={cn(
                        "text-xs md:text-sm font-medium",
                        day.isToday && "text-blue-600 bg-blue-100 rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-[10px] md:text-sm"
                      )}
                    >
                      {format(day.date, 'd')}
                    </span>
                    {day.appointments.length > 0 && (
                      <Badge variant="default" className="text-[8px] md:text-[10px] h-4 md:h-5 px-1">
                        {day.appointments.length}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-0.5 md:mt-1 overflow-y-auto max-h-10 md:max-h-16 space-y-0.5 md:space-y-1">
                    {day.appointments.slice(0, 2).map((appointment, i) => {
                      const patient = patients?.find(p => p.id === appointment.patientId);
                      const patientName = patient ? `${patient.firstName} ${patient.lastName || ''}` : '';
                      const patientStatus = (appointment as any).patientConfirmationStatus || 'pending_confirmation';
                      
                      return (
                        <div
                          key={i}
                          draggable
                          onDragStart={(e) => handleDragStart(e, appointment)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "text-[10px] md:text-xs p-0.5 md:p-1 mb-0.5 md:mb-1 text-white rounded truncate cursor-grab active:cursor-grabbing",
                            appointment.status === "completed" ? "bg-green-600" :
                            appointment.status === "cancelled" ? "bg-red-600" :
                            appointment.status === "rescheduled" ? "bg-purple-500" :
                            "bg-blue-500",
                            draggedAppointment?.id === appointment.id && "opacity-50"
                          )}
                          title={`${patientName} - ${format(new Date(appointment.date), 'p')}
Patient: ${patientStatus === 'confirmed' ? 'Confirmed' : patientStatus === 'declined' ? 'Declined' : 'Pending'}
Status: ${appointment.status}
💡 Drag to reschedule`}
                        >
                          <div className="flex items-center gap-0.5 md:gap-1">
                            <GripVertical className="h-2 w-2 md:h-3 md:w-3 flex-shrink-0 opacity-60" />
                            <span className={cn(
                              "inline-block w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0",
                              patientStatus === "confirmed" && "bg-green-300",
                              patientStatus === "pending_confirmation" && "bg-orange-300",
                              patientStatus === "declined" && "bg-red-300"
                            )} />
                            <span className="truncate hidden md:inline">{format(new Date(appointment.date), 'p')} - {patientName}</span>
                            <span className="truncate md:hidden">{format(new Date(appointment.date), 'p')}</span>
                          </div>
                        </div>
                      );
                    })}
                    {day.appointments.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{day.appointments.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Appointment Dialog */}
      {editingAppointment && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingAppointment(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Appointment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => {
                updateAppointmentMutation.mutate({ id: editingAppointment.id, data });
              })} className="space-y-4">
                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Patient</FormLabel>
                      <Popover open={editPatientSearchOpen} onOpenChange={setEditPatientSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? (() => {
                                    const patient = patients?.find((p) => p.id === field.value);
                                    return patient
                                      ? `${patient.firstName} ${patient.lastName || ''} (${patient.email})`
                                      : "Select patient";
                                  })()
                                : "Select patient"}
                              <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[90vw] sm:w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="Search patients..." />
                            <CommandList>
                              <CommandEmpty>No patient found.</CommandEmpty>
                              <CommandGroup>
                                {patients?.map((patient) => (
                                  <CommandItem
                                    key={patient.id}
                                    value={`${patient.firstName} ${patient.lastName} ${patient.email}`}
                                    onSelect={() => {
                                      field.onChange(patient.id);
                                      setEditPatientSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        patient.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date & Time</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP p")
                                ) : (
                                  <span>Pick a date and time</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const currentDate = field.value ? new Date(field.value) : new Date();
                                  date.setHours(currentDate.getHours());
                                  date.setMinutes(currentDate.getMinutes());
                                  field.onChange(date.getTime());
                                }
                              }}
                              disabled={(date) =>
                                date < new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                            <div className="p-3 border-t">
                              <div className="flex items-center gap-2">
                                <Select 
                                  value={field.value ? new Date(field.value).getHours().toString() : "9"}
                                  onValueChange={(hour) => {
                                    const date = field.value ? new Date(field.value) : new Date();
                                    date.setHours(parseInt(hour));
                                    field.onChange(date.getTime());
                                  }}
                                >
                                  <SelectTrigger className="w-[70px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => (
                                      <SelectItem key={i} value={i.toString()}>
                                        {i.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-sm">:</span>
                                <Select 
                                  value={field.value ? new Date(field.value).getMinutes().toString() : "0"}
                                  onValueChange={(minute) => {
                                    const date = field.value ? new Date(field.value) : new Date();
                                    date.setMinutes(parseInt(minute));
                                    field.onChange(date.getTime());
                                  }}
                                >
                                  <SelectTrigger className="w-[70px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[0, 15, 30, 45].map((minute) => (
                                      <SelectItem key={minute} value={minute.toString()}>
                                        {minute.toString().padStart(2, '0')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Add appointment notes..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={updateAppointmentMutation.isPending}>
                  {updateAppointmentMutation.isPending ? "Updating..." : "Update Appointment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Status Filtered Appointments Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {filteredStatus === null 
                ? "All Appointments" 
                : `${filteredStatus.charAt(0).toUpperCase() + filteredStatus.slice(1)} Appointments`}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {getFilteredAppointments().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No {filteredStatus || "all"} appointments found
              </div>
            ) : (
              <div className="space-y-2">
                {getFilteredAppointments()
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {(() => {
                              const patient = patients?.find(p => p.id === appointment.patientId);
                              return patient ? `${patient.firstName} ${patient.lastName || ''}` : 'Unknown Patient';
                            })()}
                          </p>
                          <Badge variant={
                            appointment.status === "scheduled" ? "outline" : 
                            appointment.status === "completed" ? "default" : 
                            appointment.status === "cancelled" ? "destructive" : 
                            "secondary"
                          }>
                            {appointment.status}
                          </Badge>
                          <Badge variant={
                            (appointment as any).patientConfirmationStatus === "confirmed" ? "default" : 
                            (appointment as any).patientConfirmationStatus === "pending_confirmation" ? "secondary" : 
                            (appointment as any).patientConfirmationStatus === "declined" ? "destructive" : 
                            "secondary"
                          } className={cn("text-xs",
                            (appointment as any).patientConfirmationStatus === "confirmed" && "bg-green-500 hover:bg-green-600 text-white",
                            (appointment as any).patientConfirmationStatus === "pending_confirmation" && "bg-orange-500 hover:bg-orange-600 text-white",
                            (appointment as any).patientConfirmationStatus === "declined" && "bg-red-500 hover:bg-red-600 text-white"
                          )}>
                            Patient: {(appointment as any).patientConfirmationStatus === "pending_confirmation" ? "Pending" : 
                                     (appointment as any).patientConfirmationStatus === "confirmed" ? "Confirmed" : 
                                     (appointment as any).patientConfirmationStatus === "declined" ? "Declined" : 
                                     (appointment as any).patientConfirmationStatus || 'Pending'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(appointment.date).toLocaleDateString('en-US', { 
                            month: '2-digit', 
                            day: '2-digit', 
                            year: 'numeric' 
                          })} at {new Date(appointment.date).toLocaleTimeString('en-US', { 
                            hour12: true, 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                        {appointment.notes && (
                          <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingAppointment(appointment);
                            setIsStatusDialogOpen(false);
                            setIsEditDialogOpen(true);
                          }}
                          className="flex-1 sm:flex-initial"
                        >
                          <Edit2 className="h-4 w-4 sm:mr-2" />
                          <span className="sm:inline">Edit</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this appointment?')) {
                              deleteAppointmentMutation.mutate(appointment.id);
                            }
                          }}
                          className="flex-1 sm:flex-initial"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="sm:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Drag-and-Drop Reschedule Confirmation Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              Reschedule Appointment
            </DialogTitle>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Patient:</span>{' '}
                  {(() => {
                    const patient = patients?.find(p => p.id === rescheduleTarget.appointment.patientId);
                    return patient ? `${patient.firstName} ${patient.lastName || ''}` : 'Unknown Patient';
                  })()}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Current Date:</span>{' '}
                  {format(new Date(rescheduleTarget.appointment.date), 'PPP p')}
                </p>
                <div className="border-t pt-2 mt-2">
                  <p className="text-sm font-medium text-green-600">
                    New Date: {format(rescheduleTarget.newDate, 'PPP')}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Select New Time</label>
                <div className="flex items-center gap-2">
                  <Select 
                    value={rescheduleTime.hour}
                    onValueChange={(hour) => setRescheduleTime(prev => ({...prev, hour}))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Hour" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-lg font-medium">:</span>
                  <Select 
                    value={rescheduleTime.minute}
                    onValueChange={(minute) => setRescheduleTime(prev => ({...prev, minute}))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 15, 30, 45].map((minute) => (
                        <SelectItem key={minute} value={minute.toString()}>
                          {minute.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowRescheduleDialog(false);
                    setRescheduleTarget(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={confirmReschedule}>
                  Confirm Reschedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Day Appointments Dialog */}
      <Dialog open={showDayAppointments} onOpenChange={setShowDayAppointments}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Appointments for {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {selectedDate && appointments
              ?.filter(appointment => isSameDay(new Date(appointment.date), selectedDate))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {(() => {
                          const patient = patients?.find(p => p.id === appointment.patientId);
                          return patient ? `${patient.firstName} ${patient.lastName || ''}` : 'Unknown Patient';
                        })()}
                      </p>
                      <Badge variant={
                        appointment.status === "scheduled" ? "outline" : 
                        appointment.status === "completed" ? "default" : 
                        appointment.status === "cancelled" ? "destructive" : 
                        "secondary"
                      } className={cn(
                        appointment.status === "completed" && "bg-blue-500"
                      )}>
                        {appointment.status}
                      </Badge>
                      <Badge variant={
                        (appointment as any).patientConfirmationStatus === "confirmed" ? "default" : 
                        (appointment as any).patientConfirmationStatus === "pending_confirmation" ? "secondary" : 
                        (appointment as any).patientConfirmationStatus === "declined" ? "destructive" : 
                        "secondary"
                      } className={cn("text-xs",
                        (appointment as any).patientConfirmationStatus === "confirmed" && "bg-green-500 hover:bg-green-600 text-white",
                        (appointment as any).patientConfirmationStatus === "pending_confirmation" && "bg-orange-500 hover:bg-orange-600 text-white",
                        (appointment as any).patientConfirmationStatus === "declined" && "bg-red-500 hover:bg-red-600 text-white"
                      )}>
                        Patient Confirmation: {(appointment as any).patientConfirmationStatus === "pending_confirmation" ? "Pending" : 
                                 (appointment as any).patientConfirmationStatus === "confirmed" ? "Confirmed" : 
                                 (appointment as any).patientConfirmationStatus === "declined" ? "Declined" : 
                                 (appointment as any).patientConfirmationStatus || 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(appointment.date), "p")}
                    </p>
                    {appointment.notes && (
                      <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          Update Status
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                          <h4 className="font-medium">Update Appointment Status</h4>
                          <p className="text-xs text-muted-foreground">This is your internal appointment status (not patient confirmation)</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "scheduled")}
                            >
                              Scheduled
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "completed")}
                            >
                              Completed
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "cancelled")}
                            >
                              Cancelled
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="justify-start" 
                              onClick={() => updateAppointmentStatus(appointment.id, "rescheduled")}
                            >
                              Rescheduled
                            </Button>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Custom Status:</label>
                            <div className="flex mt-1 gap-2">
                              <Input 
                                placeholder="Enter custom status"
                                value={customStatus}
                                onChange={(e) => setCustomStatus(e.target.value)}
                                className="h-8"
                              />
                              <Button 
                                size="sm"
                                disabled={!customStatus}
                                onClick={() => {
                                  if (customStatus) {
                                    updateAppointmentStatus(appointment.id, customStatus);
                                    setCustomStatus("");
                                  }
                                }}
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditingAppointment(appointment);
                        setShowDayAppointments(false);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this appointment?')) {
                          deleteAppointmentMutation.mutate(appointment.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}