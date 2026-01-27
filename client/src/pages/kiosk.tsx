import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  UserPlus, 
  Clock, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  User,
  Camera,
  FileText,
  Touchscreen,
  Users,
  Wifi,
  Battery,
  Shield,
  Loader2,
  Calendar as CalendarIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";

interface PatientData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  insuranceProvider: string;
  insuranceMemberId: string;
  reasonForVisit: string;
  hasArrived: boolean;
  checkInTime: string;
  estimatedWaitTime: number;
}

interface KioskStatus {
  isOnline: boolean;
  currentTime: Date;
  clinicStatus: 'open' | 'closed' | 'lunch';
  nextAvailableTime: Date | null;
  totalPatientsWaiting: number;
  averageWaitTime: number;
}

export default function KioskPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, logoutMutation } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'register' | 'confirm' | 'waiting' | 'appointment-select'>('welcome');
  const [patientData, setPatientData] = useState<Partial<PatientData>>({});
  const [kioskStatus, setKioskStatus] = useState<KioskStatus>({
    isOnline: true,
    currentTime: new Date(),
    clinicStatus: 'open',
    nextAvailableTime: null,
    totalPatientsWaiting: 0,
    averageWaitTime: 15
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(300); // 5 minutes
  const [touchActive, setTouchActive] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');
  const [appointmentTypes, setAppointmentTypes] = useState([
    { id: 'checkup', name: 'General Checkup', duration: 30, icon: 'User' },
    { id: 'followup', name: 'Follow-up Visit', duration: 20, icon: 'Calendar' },
    { id: 'urgent', name: 'Urgent Care', duration: 15, icon: 'AlertCircle' },
    { id: 'specialist', name: 'Specialist Consultation', duration: 45, icon: 'UserPlus' }
  ]);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setKioskStatus(prev => ({
        ...prev,
        currentTime: new Date()
      }));
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Session timeout logic
  useEffect(() => {
    if (sessionTimeout <= 0) {
      setCurrentScreen('welcome');
      setPatientData({});
      setRegistrationComplete(false);
      return;
    }

    const timer = setTimeout(() => {
      setSessionTimeout(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessionTimeout]);

  // Reset timeout on user activity
  const resetTimeout = () => {
    setSessionTimeout(300);
  };

  // Fetch appointments data
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<any[]>({
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/appointments');
      return res.json();
    }
  });

  // Fetch patients data
  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ['/api/patients'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/patients');
      return res.json();
    }
  });

  // Check if appointment is today and sort by date
  const todayAppointments = appointments.filter(appointment => {
    const appDate = new Date(appointment.date);
    const today = new Date();
    return appDate.toDateString() === today.toDateString();
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  const checkInMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PATCH', `/api/appointments/${id}`, { status: 'checked_in' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({
        title: 'Checked In',
        description: 'You have successfully checked in.',
      });
      setSelectedAppointment(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Check-in failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoadingAppointments) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2 relative">
          <Button
            variant="ghost"
            className="absolute right-0 top-0 text-muted-foreground"
            onClick={() => logoutMutation.mutate()}
          >
            Logout
          </Button>
          <h1 className="text-4xl font-bold tracking-tight text-primary">Welcome to {user?.name || "The Clinic"}</h1>
          <p className="text-xl text-muted-foreground">Please tap your name to check in</p>
          <div className="flex items-center justify-center gap-2 text-lg font-medium text-slate-600 mt-4">
            <CalendarIcon className="h-5 w-5" />
            {format(today, "EEEE, MMMM d, yyyy")}
          </div>
        </div>

        <div className="grid gap-4">
          {todayAppointments.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <p className="text-xl">No appointments scheduled for today.</p>
            </Card>
          ) : (
            todayAppointments.map((appointment) => {
              const patient = patients?.find(p => p.id === appointment.patientId);
              const isCheckedIn = appointment.status === "checked_in" || appointment.status === "arrived" || appointment.status === "completed" || appointment.status === "in_progress";

              if (!patient) return null;

              return (
                <Card
                  key={appointment.id}
                  className={`cursor-pointer transition-all hover:shadow-lg active:scale-[0.99] border-l-4 ${
                    isCheckedIn ? "border-l-green-500 bg-green-50/50" : "border-l-primary"
                  }`}
                  onClick={() => !isCheckedIn && setSelectedAppointment(appointment)}
                >
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-6">
                      <div className="bg-primary/10 p-3 rounded-full">
                        <Clock className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold">
                          {format(new Date(appointment.date), "h:mm a")}
                        </h3>
                        <p className="text-lg text-slate-600 font-medium">
                          {patient.firstName} {patient.lastName}
                        </p>
                      </div>
                    </div>

                    {isCheckedIn ? (
                      <div className="flex items-center gap-2 text-green-600 font-bold text-lg px-4 py-2 bg-green-100 rounded-full">
                        <CheckCircle2 className="h-6 w-6" />
                        Checked In
                      </div>
                    ) : (
                      <Button size="lg" className="text-lg px-8 py-6 rounded-full pointer-events-none">
                        Tap to Check In
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!selectedAppointment} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Check-in</DialogTitle>
            <DialogDescription>
              Are you {patients?.find(p => p.id === selectedAppointment?.patientId)?.firstName} {patients?.find(p => p.id === selectedAppointment?.patientId)?.lastName}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
             <div className="bg-primary/5 p-6 rounded-full">
                <User className="h-12 w-12 text-primary" />
             </div>
          </div>
          <DialogFooter className="sm:justify-center gap-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => setSelectedAppointment(null)}
            >
              No, Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => selectedAppointment && checkInMutation.mutate(selectedAppointment.id)}
              disabled={checkInMutation.isPending}
            >
              {checkInMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
