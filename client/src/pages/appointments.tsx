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
import { Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Mail } from "lucide-react";
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
          <div className="grid gap-4">
            {appointments?.length === 0 ? (
              <div className="text-center p-6 border rounded-lg">
                <p className="text-muted-foreground">No appointments scheduled.</p>
              </div>
            ) : (
              appointments?.map((appointment) => (
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
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 md:p-4 border-b">
              <h3 className="font-medium text-sm md:text-base">{format(currentMonth, 'MMMM yyyy')}</h3>
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
                <div key={`empty-${index}`} className="h-16 md:h-24 border-t border-r p-0.5 md:p-1 bg-gray-50"></div>
              ))}

              {days.map((day, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-16 md:h-24 border-t border-r p-0.5 md:p-1 cursor-pointer hover:bg-gray-50",
                    day.isToday && "bg-blue-50",
                    selectedDate && isSameDay(day.date, selectedDate) && "ring-2 ring-blue-500",
                    "relative overflow-hidden"
                  )}
                  onClick={() => {
                    setSelectedDate(day.date);
                    if (day.appointments.length > 0) {
                      setShowDayAppointments(true);
                    }
                  }}
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
                          className={cn(
                            "text-[10px] md:text-xs p-0.5 md:p-1 mb-0.5 md:mb-1 text-white rounded truncate",
                            appointment.status === "completed" ? "bg-green-600" :
                            appointment.status === "cancelled" ? "bg-red-600" :
                            "bg-blue-500"
                          )}
                          title={`${patientName} - ${format(new Date(appointment.date), 'p')}
Patient: ${patientStatus === 'confirmed' ? 'Confirmed' : patientStatus === 'declined' ? 'Declined' : 'Pending'}
Status: ${appointment.status}`}
                        >
                          <div className="flex items-center gap-0.5 md:gap-1">
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