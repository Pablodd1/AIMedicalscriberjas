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
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function Appointments() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [customStatus, setCustomStatus] = useState("");

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

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
      date: new Date().getTime(), // Using timestamp for consistency
      notes: "",
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
        date: new Date().getTime(), // Using timestamp for consistency
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Appointments</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                    <FormItem>
                      <FormLabel>Patient</FormLabel>
                      <Select onValueChange={value => field.onChange(parseInt(value))} value={field.value.toString()}>
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
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
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
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
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
                                // Use timestamp for consistency
                                field.onChange(date.getTime());
                              }
                            }}
                            disabled={(date) =>
                              date < new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
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
                  className="flex items-center justify-between p-4 border rounded-lg"
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
                  </div>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Badge variant={
                            appointment.status === "scheduled" ? "default" : 
                            appointment.status === "completed" ? "success" : 
                            appointment.status === "cancelled" ? "destructive" : 
                            "secondary"
                          } className="mr-2">
                            {appointment.status}
                          </Badge>
                          Update
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                          <h4 className="font-medium">Update Appointment Status</h4>
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
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium">{format(currentMonth, 'MMMM yyyy')}</h3>
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="py-2 font-medium text-xs">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: getDay(days[0].date) }).map((_, index) => (
                <div key={`empty-${index}`} className="h-24 border-t border-r p-1 bg-gray-50"></div>
              ))}

              {days.map((day, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-24 border-t border-r p-1",
                    day.isToday && "bg-blue-50",
                    selectedDate && isSameDay(day.date, selectedDate) && "ring-2 ring-blue-500",
                    "relative overflow-hidden"
                  )}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        day.isToday && "text-blue-600 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center"
                      )}
                    >
                      {format(day.date, 'd')}
                    </span>
                    {day.appointments.length > 0 && (
                      <Badge variant="default" className="text-[10px]">
                        {day.appointments.length}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 overflow-y-auto max-h-16">
                    {day.appointments.slice(0, 2).map((appointment, i) => (
                      <div
                        key={i}
                        className="text-xs p-1 mb-1 bg-blue-500 text-white rounded truncate"
                        title={`${(() => {
                          const patient = patients?.find(p => p.id === appointment.patientId);
                          return patient ? `${patient.firstName} ${patient.lastName || ''}` : '';
                        })()} - ${format(new Date(appointment.date), 'p')}`}
                      >
                        {format(new Date(appointment.date), 'p')} - {(() => {
                          const patient = patients?.find(p => p.id === appointment.patientId);
                          return patient ? `${patient.firstName} ${patient.lastName || ''}` : '';
                        })()}
                      </div>
                    ))}
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
    </div>
  );
}