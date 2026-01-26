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
  Monitor,
  Users,
  Wifi,
  Battery,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setKioskStatus(prev => ({
        ...prev,
        currentTime: new Date()
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Session timeout handling
  useEffect(() => {
    const resetTimeout = () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
      
      sessionTimeoutRef.current = setTimeout(() => {
        handleSessionTimeout();
      }, sessionTimeout * 1000);
    };

    resetTimeout();

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [sessionTimeout]);

  // Touch screen feedback
  const handleTouchStart = () => {
    setTouchActive(true);
    setTimeout(() => setTouchActive(false), 150);
  };

  const handleSessionTimeout = () => {
    setCurrentScreen('welcome');
    setPatientData({});
    setSignatureData('');
    toast({
      title: "Session Timed Out",
      description: "Your session has expired. Please start again.",
      duration: 3000
    });
  };

  const handleWelcomeScreen = () => {
    setCurrentScreen('appointment-select');
  };

  const handleAppointmentSelection = (appointmentType: any) => {
    setPatientData(prev => ({ ...prev, appointmentType: appointmentType.name }));
    setCurrentScreen('register');
  };

  const handleRegistrationSubmit = async (data: PatientData) => {
    setIsSubmitting(true);

    try {
      // Submit to kiosk registration endpoint
      const response = await fetch('/api/kiosk/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kiosk-Token': process.env.VITE_KIOSK_TOKEN || 'kiosk-access-token'
        },
        body: JSON.stringify({
          ...data,
          checkInTime: new Date().toISOString(),
          kioskId: 'main-lobby',
          signatureData: signatureData
        })
      });

      if (response.ok) {
        const result = await response.json();
        setPatientData(prev => ({ 
          ...prev, 
          id: result.patientId,
          hasArrived: true,
          checkInTime: new Date().toLocaleTimeString(),
          estimatedWaitTime: result.estimatedWaitTime || 15
        }));
        setRegistrationComplete(true);
        setCurrentScreen('confirm');
        
        toast({
          title: "Registration Successful",
          description: `You are checked in. Estimated wait time: ${result.estimatedWaitTime || 15} minutes`,
          duration: 3000
        });
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      console.error('Kiosk registration error:', error);
      toast({
        title: "Registration Error",
        description: "Unable to complete registration. Please see reception staff.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAndProceed = () => {
    setCurrentScreen('waiting');
  };

  const handleStartOver = () => {
    setCurrentScreen('welcome');
    setPatientData({});
    setSignatureData('');
    setRegistrationComplete(false);
  };

  const handlePrintPass = () => {
    // Print check-in pass
    window.print();
  };

  // Format time display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-red-600 bg-red-100';
      case 'lunch': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col"
         onTouchStart={handleTouchStart}
         style={{ touchAction: 'manipulation' }}>
      
      {/* Kiosk Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Touchscreen className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Patient Check-In Kiosk</h1>
              <p className="text-sm text-gray-600">Touch screen to begin</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Wifi className={cn("h-5 w-5", kioskStatus.isOnline ? "text-green-600" : "text-red-600")} />
              <span className="text-sm text-gray-600">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <Battery className="h-5 w-5 text-green-600" />
              <span className="text-sm text-gray-600">Ready</span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(kioskStatus.currentTime)}
              </div>
              <div className="text-xs text-gray-500">
                {kioskStatus.currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto h-full">
          
          {/* Welcome Screen */}
          {currentScreen === 'welcome' && (
            <div className="flex items-center justify-center h-full">
              <Card className="w-full max-w-2xl">
                <CardContent className="p-12 text-center space-y-8">
                  <div className="flex justify-center">
                    <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                      <UserPlus className="h-16 w-16 text-blue-600" />
                    </div>
                  </div>
                  
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Welcome to Our Clinic
                  </h2>
                  
                  <p className="text-lg text-gray-600 mb-8">
                    Please touch the screen below to check in for your appointment
                  </p>
                  
                  <Button 
                    size="lg" 
                    className="h-20 w-64 text-xl rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
                    onClick={handleWelcomeScreen}
                  >
                    <User className="h-6 w-6 mr-3" />
                    Check In Now
                  </Button>
                  
                  <div className="text-sm text-gray-500 space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span>Your information is secure and private</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>Average wait time: {kioskStatus.averageWaitTime} minutes</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Appointment Type Selection */}
          {currentScreen === 'appointment-select' && (
            <div className="flex items-center justify-center h-full">
              <Card className="w-full max-w-3xl">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">What type of appointment?</CardTitle>
                  <p className="text-gray-600">Please select your visit type</p>
                </CardHeader>
                
                <CardContent className="grid grid-cols-2 gap-6 p-8">
                  {appointmentTypes.map((type) => (
                    <Button
                      key={type.id}
                      variant="outline"
                      className="h-32 p-6 flex flex-col items-center gap-3 hover:shadow-lg transition-all duration-200"
                      onClick={() => handleAppointmentSelection(type)}
                    >
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserPlus className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg">{type.name}</div>
                        <div className="text-sm text-gray-500">{type.duration} minutes</div>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Registration Form */}
          {currentScreen === 'register' && (
            <div className="flex items-center justify-center h-full">
              <Card className="w-full max-w-4xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Patient Information</CardTitle>
                  <p className="text-center text-gray-600">
                    Please enter your details to complete check-in
                  </p>
                </CardHeader>
                
                <CardContent className="p-6">
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Personal Information */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="firstName" className="text-lg font-medium">First Name *</Label>
                          <Input
                            id="firstName"
                            type="text"
                            className="h-12 text-lg"
                            value={patientData.firstName || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="Enter first name"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="lastName" className="text-lg font-medium">Last Name *</Label>
                          <Input
                            id="lastName"
                            type="text"
                            className="h-12 text-lg"
                            value={patientData.lastName || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Enter last name"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="email" className="text-lg font-medium">Email Address *</Label>
                          <Input
                            id="email"
                            type="email"
                            className="h-12 text-lg"
                            value={patientData.email || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="email@example.com"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="phone" className="text-lg font-medium">Phone Number *</Label>
                          <Input
                            id="phone"
                            type="tel"
                            className="h-12 text-lg"
                            value={patientData.phone || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="(555) 123-4567"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="dateOfBirth" className="text-lg font-medium">Date of Birth *</Label>
                          <Input
                            id="dateOfBirth"
                            type="date"
                            className="h-12 text-lg"
                            value={patientData.dateOfBirth || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                          />
                        </div>
                      </div>
                      
                      {/* Additional Information */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="address" className="text-lg font-medium">Address</Label>
                          <Input
                            id="address"
                            type="text"
                            className="h-12 text-lg"
                            value={patientData.address || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="123 Main St, City, State"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="emergencyContact" className="text-lg font-medium">Emergency Contact</Label>
                          <Input
                            id="emergencyContact"
                            type="text"
                            className="h-12 text-lg"
                            value={patientData.emergencyContact || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                            placeholder="Emergency contact name"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="emergencyPhone" className="text-lg font-medium">Emergency Phone</Label>
                          <Input
                            id="emergencyPhone"
                            type="tel"
                            className="h-12 text-lg"
                            value={patientData.emergencyPhone || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                            placeholder="Emergency contact phone"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="reasonForVisit" className="text-lg font-medium">Reason for Visit *</Label>
                          <textarea
                            id="reasonForVisit"
                            className="h-24 w-full text-lg p-3 border rounded-lg resize-none"
                            value={patientData.reasonForVisit || ''}
                            onChange={(e) => setPatientData(prev => ({ ...prev, reasonForVisit: e.target.value }))}
                            placeholder="Please describe why you're visiting today"
                          />
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                  
                  <Separator className="my-6" />
                  
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 px-8"
                      onClick={handleStartOver}
                    >
                      Cancel
                    </Button>
                    
                    <Button
                      size="lg"
                      className="h-14 px-8 text-lg"
                      onClick={() => handleRegistrationSubmit(patientData as PatientData)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Processing...' : 'Complete Check-In'}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Confirmation Screen */}
          {currentScreen === 'confirm' && (
            <div className="flex items-center justify-center h-full">
              <Card className="w-full max-w-3xl">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-green-600">
                    <CheckCircle className="inline mr-2 h-8 w-8" />
                    Check-In Complete
                  </CardTitle>
                  <p className="text-gray-600">
                    You have been successfully checked in
                  </p>
                </CardHeader>
                
                <CardContent className="space-y-6 p-8">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="grid grid-cols-2 gap-4 text-lg">
                      <div>
                        <span className="font-medium text-gray-600">Name:</span>
                        <p className="font-semibold">
                          {patientData.firstName} {patientData.lastName}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Check-in Time:</span>
                        <p className="font-semibold">{patientData.checkInTime}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Estimated Wait:</span>
                        <p className="font-semibold text-orange-600">
                          {patientData.estimatedWaitTime} minutes
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Status:</span>
                        <Badge className="bg-blue-100 text-blue-800">In Waiting Room</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center space-y-4">
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertTitle>Please wait patiently</AlertTitle>
                      <AlertDescription>
                        You will be called when the doctor is ready. The waiting area has comfortable seating and refreshments.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-14 px-8"
                        onClick={handlePrintPass}
                      >
                        <FileText className="mr-2 h-5 w-5" />
                        Print Pass
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-14 px-8"
                        onClick={handleStartOver}
                      >
                        <Users className="mr-2 h-5 w-5" />
                        Another Patient
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Waiting Room Display */}
          {currentScreen === 'waiting' && (
            <div className="space-y-6">
              {/* Clinic Status Bar */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium",
                        getStatusColor(kioskStatus.clinicStatus)
                      )}>
                        {kioskStatus.clinicStatus.toUpperCase()}
                      </div>
                      <span className="text-lg font-medium">
                        {kioskStatus.clinicStatus === 'open' && 'Clinic is Open'}
                        {kioskStatus.clinicStatus === 'closed' && 'Clinic is Closed'}
                        {kioskStatus.clinicStatus === 'lunch' && 'At Lunch - Reopens at 2:00 PM'}
                      </span>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Patients Waiting</div>
                      <div className="text-3xl font-bold text-blue-600">
                        {kioskStatus.totalPatientsWaiting}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Waiting List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    Waiting Room
                  </CardTitle>
                  <p>Current wait time: {kioskStatus.averageWaitTime} minutes</p>
                </CardHeader>
                
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="divide-y">
                      {/* Current patient */}
                      <div className="p-4 bg-blue-50 border-l-4 border-l-blue-500">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-lg">
                              {patientData.firstName} {patientData.lastName}
                            </div>
                            <div className="text-sm text-gray-600">
                              Checked in: {patientData.checkInTime}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-blue-100 text-blue-800 text-lg px-3 py-1">
                              Currently Waiting
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Other waiting patients would be listed here */}
                      <div className="p-4 text-center text-gray-500">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Other patients waiting...</p>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Please remain in the waiting area</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Phone className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Listen for your name to be called</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <MapPin className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">Restrooms and refreshments available</span>
                    </div>
                    
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Need to change information?</p>
                      <Button
                        variant="outline"
                        onClick={handleStartOver}
                        className="h-12"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Check In Another Patient
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Footer - Kiosk Info */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-5 w-5 text-green-600" />
            <span className="text-sm text-gray-600">Secure Check-In System</span>
          </div>
          
          <div className="text-sm text-gray-500">
            {patientData.id ? (
              <span>Patient ID: {patientData.id}</span>
            ) : (
              <span>Ready for Check-In</span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartOver}
            className="h-8"
          >
            Start Over
          </Button>
        </div>
      </footer>

      {/* Touch indicator - visual feedback */}
      {touchActive && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
            Touch Detected
          </div>
        </div>
      )}
    </div>
  );
}