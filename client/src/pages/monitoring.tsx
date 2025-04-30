import { useState } from "react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bluetooth,
  Activity,
  Droplet,
  Bell,
  Shield,
  Plus,
  Trash,
  Settings,
  RotateCcw,
  RefreshCcw,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Patient } from "@shared/schema";

// Device types
interface Device {
  id: string;
  name: string;
  type: "bp" | "glucose";
  model: string;
  status: "connected" | "disconnected" | "pairing";
  lastReading?: {
    value: string | number;
    timestamp: Date;
    unit: string;
  }
}

// Reading types
interface BPReading {
  id: string;
  patientId: number;
  deviceId: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  timestamp: Date;
}

interface GlucoseReading {
  id: string;
  patientId: number;
  deviceId: string;
  value: number;
  type: "fasting" | "pre-meal" | "post-meal" | "random";
  timestamp: Date;
}

type Reading = BPReading | GlucoseReading;

// Sample data for demo purposes (will be replaced with real data in production)
const mockDevices: Device[] = [
  {
    id: "dev-001",
    name: "iHealth Track BP",
    type: "bp",
    model: "iHealth Track Connected",
    status: "connected",
    lastReading: {
      value: "120/80",
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      unit: "mmHg"
    }
  },
  {
    id: "dev-002",
    name: "CareSens Glucose",
    type: "glucose",
    model: "CareSens N Plus",
    status: "connected",
    lastReading: {
      value: 105,
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      unit: "mg/dL"
    }
  }
];

// Get sample readings (will be replaced with API calls in production)
const getLast7DaysReadings = (type: "bp" | "glucose"): Reading[] => {
  if (type === "bp") {
    return Array(7).fill(null).map((_, i) => ({
      id: `bp-${i}`,
      patientId: 15,
      deviceId: "dev-001",
      systolic: Math.floor(Math.random() * 30) + 110, // Between 110-140
      diastolic: Math.floor(Math.random() * 20) + 70, // Between 70-90
      pulse: Math.floor(Math.random() * 20) + 60, // Between 60-80
      timestamp: new Date(Date.now() - (i * 24 * 3600000)) // Days ago
    })) as BPReading[];
  } else {
    return Array(7).fill(null).map((_, i) => ({
      id: `gluc-${i}`,
      patientId: 15,
      deviceId: "dev-002",
      value: Math.floor(Math.random() * 40) + 90, // Between 90-130
      type: ["fasting", "pre-meal", "post-meal", "random"][Math.floor(Math.random() * 4)] as "fasting" | "pre-meal" | "post-meal" | "random",
      timestamp: new Date(Date.now() - (i * 24 * 3600000)) // Days ago
    })) as GlucoseReading[];
  }
};

// Alert thresholds
const initialAlertSettings = {
  bp: {
    systolicHigh: 140,
    systolicLow: 90,
    diastolicHigh: 90,
    diastolicLow: 60,
    pulseHigh: 100,
    pulseLow: 50,
    enabled: true,
    notify: ["patient", "doctor"]
  },
  glucose: {
    fastingHigh: 130,
    fastingLow: 70,
    preMealHigh: 130, 
    preMealLow: 70,
    postMealHigh: 180,
    postMealLow: 70,
    enabled: true,
    notify: ["patient", "doctor"]
  }
};

export default function MonitoringSystem() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showConfigureDevice, setShowConfigureDevice] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [alertSettings, setAlertSettings] = useState(initialAlertSettings);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [alertType, setAlertType] = useState<"bp" | "glucose">("bp");

  // Get patients for the dropdown
  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // This would fetch real readings in production
  const bpReadings = getLast7DaysReadings("bp") as BPReading[];
  const glucoseReadings = getLast7DaysReadings("glucose") as GlucoseReading[];

  // Handler for pairing new devices
  const pairDevice = (deviceType: string, model: string) => {
    toast({
      title: "Searching for Devices",
      description: "Please ensure your device is in pairing mode.",
    });
    
    // In a real app, this would initiate a Bluetooth scan
    setTimeout(() => {
      setDevices([
        ...devices,
        {
          id: `dev-${Math.floor(Math.random() * 1000)}`,
          name: `${model} (New)`,
          type: deviceType as "bp" | "glucose",
          model: model,
          status: "connected"
        }
      ]);
      
      setShowAddDevice(false);
      
      toast({
        title: "Device Connected",
        description: `${model} has been successfully paired.`,
      });
    }, 2000);
  };

  // Simulate device connection status update
  const toggleDeviceConnection = (deviceId: string) => {
    setDevices(devices.map(device => 
      device.id === deviceId 
        ? { ...device, status: device.status === "connected" ? "disconnected" : "connected" } 
        : device
    ));
    
    const device = devices.find(d => d.id === deviceId);
    
    toast({
      title: device?.status === "connected" ? "Device Disconnected" : "Device Connected",
      description: `${device?.name} is now ${device?.status === "connected" ? "disconnected" : "connected"}.`,
    });
  };

  // Configure device
  const openDeviceConfig = (device: Device) => {
    setSelectedDevice(device);
    setShowConfigureDevice(true);
  };

  // Remove device
  const removeDevice = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    
    setDevices(devices.filter(device => device.id !== deviceId));
    
    toast({
      title: "Device Removed",
      description: `${device?.name} has been removed from your account.`,
      variant: "destructive"
    });
  };

  // Open alert settings
  const openAlertSettings = (type: "bp" | "glucose") => {
    setAlertType(type);
    setShowAlertSettings(true);
  };

  // Format reading date
  const formatReadingDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  // Get appropriate color based on blood pressure
  const getBPColor = (systolic: number, diastolic: number) => {
    if (systolic >= 140 || diastolic >= 90) return "text-medical-red";
    if (systolic <= 90 || diastolic <= 60) return "text-blue-500";
    return "text-emerald-500";
  };

  // Get appropriate color based on glucose reading
  const getGlucoseColor = (value: number, type: string) => {
    if (type === "fasting" || type === "pre-meal") {
      if (value > 130) return "text-medical-red";
      if (value < 70) return "text-blue-500";
    } else if (type === "post-meal") {
      if (value > 180) return "text-medical-red";
      if (value < 70) return "text-blue-500";
    }
    return "text-emerald-500";
  };

  // Simulate sending alerts to providers
  const sendTestAlert = () => {
    toast({
      title: "Test Alert Sent",
      description: "A test alert has been successfully sent to all configured recipients.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Patient Monitoring System</h1>
          <p className="text-muted-foreground">Monitor vital signs with connected medical devices</p>
        </div>
      </div>
      
      <Tabs defaultValue="dashboard" value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 md:w-[400px]">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Blood Pressure Card */}
            <Card className="relative">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-medical-dark-blue" /> 
                    Blood Pressure
                  </CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" 
                          onClick={() => openAlertSettings("bp")}>
                          <Bell className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Configure BP Alerts</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>
                  Last 7 days readings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bpReadings.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 px-4 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">Latest Reading</span>
                      <Badge variant="outline" className="font-mono">
                        {formatReadingDate(bpReadings[0].timestamp)}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-center gap-4 items-center">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getBPColor(bpReadings[0].systolic, bpReadings[0].diastolic)}`}>
                          {bpReadings[0].systolic}/{bpReadings[0].diastolic}
                        </div>
                        <div className="text-sm text-muted-foreground">mmHg</div>
                      </div>
                      <Separator orientation="vertical" className="h-12" />
                      <div className="text-center">
                        <div className="text-2xl font-semibold">
                          {bpReadings[0].pulse}
                        </div>
                        <div className="text-sm text-muted-foreground">BPM</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium mb-2">History</div>
                      {bpReadings.slice(0, 5).map((reading, index) => (
                        <div key={reading.id} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                          <div className="text-sm">
                            {formatReadingDate(reading.timestamp)}
                          </div>
                          <div className="flex gap-3 items-center">
                            <span className={`font-mono ${getBPColor(reading.systolic, reading.diastolic)}`}>
                              {reading.systolic}/{reading.diastolic}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {reading.pulse} BPM
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="text-muted-foreground">No readings available</div>
                    <Button variant="outline" className="mt-4" onClick={() => setSelectedTab("devices")}>
                      Configure Device
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Glucose Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Droplet className="h-5 w-5 mr-2 text-medical-dark-blue" /> 
                    Blood Glucose
                  </CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" 
                          onClick={() => openAlertSettings("glucose")}>
                          <Bell className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Configure Glucose Alerts</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>
                  Last 7 days readings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {glucoseReadings.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 px-4 bg-muted/50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium">Latest Reading</span>
                        <Badge className="ml-2">{glucoseReadings[0].type}</Badge>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {formatReadingDate(glucoseReadings[0].timestamp)}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-center">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getGlucoseColor(glucoseReadings[0].value, glucoseReadings[0].type)}`}>
                          {glucoseReadings[0].value}
                        </div>
                        <div className="text-sm text-muted-foreground">mg/dL</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium mb-2">History</div>
                      {glucoseReadings.slice(0, 5).map((reading, index) => (
                        <div key={reading.id} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm">
                              {formatReadingDate(reading.timestamp)}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {reading.type}
                            </Badge>
                          </div>
                          <div className="flex items-center">
                            <span className={`font-mono ${getGlucoseColor(reading.value, reading.type)}`}>
                              {reading.value}
                            </span>
                            <span className="text-sm text-muted-foreground ml-1">
                              mg/dL
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="text-muted-foreground">No readings available</div>
                    <Button variant="outline" className="mt-4" onClick={() => setSelectedTab("devices")}>
                      Configure Device
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Patient Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Patient Selection</CardTitle>
              <CardDescription>
                Select a patient to view their monitoring data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient">Patient</Label>
                    <Select defaultValue="15">
                      <SelectTrigger>
                        <SelectValue placeholder="Select Patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients?.map(patient => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.firstName} {patient.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date-range">Date Range</Label>
                    <Select defaultValue="7d">
                      <SelectTrigger>
                        <SelectValue placeholder="Select Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full">
                      Update Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* System Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center">
                <Shield className="h-5 w-5 mr-2 text-medical-dark-blue" /> 
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center p-3 bg-muted/50 rounded-lg">
                  <div className="mr-4">
                    <Bluetooth className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Device Connection</div>
                    <div className="text-sm text-muted-foreground">
                      {devices.filter(d => d.status === "connected").length} of {devices.length} connected
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center p-3 bg-muted/50 rounded-lg">
                  <div className="mr-4">
                    <Activity className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Data Syncing</div>
                    <div className="text-sm text-muted-foreground">
                      Last sync: {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center p-3 bg-muted/50 rounded-lg">
                  <div className="mr-4">
                    <Bell className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Alerts</div>
                    <div className="text-sm text-muted-foreground">
                      All systems operational
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={sendTestAlert}>
                    Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Connected Devices</h2>
            <Button onClick={() => setShowAddDevice(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map(device => (
              <Card key={device.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-medium flex items-center">
                      {device.type === "bp" ? (
                        <Activity className="h-5 w-5 mr-2 text-medical-dark-blue" />
                      ) : (
                        <Droplet className="h-5 w-5 mr-2 text-medical-dark-blue" />
                      )}
                      {device.name}
                    </CardTitle>
                    <Badge 
                      variant={device.status === "connected" ? "default" : "outline"}
                      className={device.status === "connected" ? "bg-emerald-500 hover:bg-emerald-500/90" : ""}
                    >
                      {device.status === "connected" ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {device.model}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {device.lastReading && (
                      <>
                        <div className="text-sm text-muted-foreground">
                          Last Reading: {formatReadingDate(device.lastReading.timestamp)}
                        </div>
                        <div className="text-2xl font-bold text-center">
                          {device.lastReading.value} <span className="text-sm text-muted-foreground">{device.lastReading.unit}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between">
                      <Button variant="outline" size="sm" onClick={() => toggleDeviceConnection(device.id)}>
                        {device.status === "connected" ? "Disconnect" : "Connect"}
                      </Button>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openDeviceConfig(device)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-medical-red" onClick={() => removeDevice(device.id)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {devices.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center">
                  <div className="text-muted-foreground">No devices connected</div>
                  <Button className="mt-4" onClick={() => setShowAddDevice(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Device
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Recommended FDA-Cleared Devices</CardTitle>
              <CardDescription>
                These devices are compatible with our monitoring system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold mb-2">Blood Pressure Monitors</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium">iHealth Track Connected Blood Pressure Monitor</div>
                      <div className="text-sm text-muted-foreground my-1">FDA 510(k) cleared, Bluetooth connectivity</div>
                      <div className="text-sm">$29.99 per unit</div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => pairDevice("bp", "iHealth Track Connected")}>
                          Pair Device
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium">Wellue BP2A Wireless Smart Blood Pressure Monitor</div>
                      <div className="text-sm text-muted-foreground my-1">FDA cleared, one-piece cuff design</div>
                      <div className="text-sm">$81.99 per unit</div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => pairDevice("bp", "Wellue BP2A Wireless")}>
                          Pair Device
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-base font-semibold mb-2">Glucose Monitors</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium">CareSens N Plus Bluetooth Blood Glucose Monitor</div>
                      <div className="text-sm text-muted-foreground my-1">FDA cleared, includes 100 test strips</div>
                      <div className="text-sm">$39.99 per unit</div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => pairDevice("glucose", "CareSens N Plus")}>
                          Pair Device
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium">GluNEO Smart GDH-FAD Autocoding Bluetooth Glucose Meter</div>
                      <div className="text-sm text-muted-foreground my-1">FDA and CE approved, 5-second result display</div>
                      <div className="text-sm">Contact supplier for pricing</div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => pairDevice("glucose", "GluNEO Smart GDH-FAD")}>
                          Pair Device
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Blood Pressure Report</CardTitle>
                  <CardDescription>
                    Weekly summary and trends analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-[2/1] bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground">
                    BP readings visualization chart will appear here
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 border rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Average</div>
                      <div className="text-xl font-bold">122/78</div>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Highest</div>
                      <div className="text-xl font-bold text-medical-red">138/89</div>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Lowest</div>
                      <div className="text-xl font-bold text-blue-500">104/65</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="mr-2">
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button size="sm">
                      Generate Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Glucose Monitoring Report</CardTitle>
                  <CardDescription>
                    Weekly summary and meal-related patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-[2/1] bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground">
                    Glucose readings visualization chart will appear here
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 border rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Fasting</div>
                      <div className="text-xl font-bold">102</div>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Pre-meal</div>
                      <div className="text-xl font-bold">110</div>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Post-meal</div>
                      <div className="text-xl font-bold text-medical-red">142</div>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Average</div>
                      <div className="text-xl font-bold">117</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="mr-2">
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button size="sm">
                      Generate Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Report Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Patient</Label>
                    <Select defaultValue="15">
                      <SelectTrigger>
                        <SelectValue placeholder="Select Patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients?.map(patient => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.firstName} {patient.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Time Range</Label>
                    <Select defaultValue="7days">
                      <SelectTrigger>
                        <SelectValue placeholder="Select Time Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24hours">Last 24 Hours</SelectItem>
                        <SelectItem value="7days">Last 7 Days</SelectItem>
                        <SelectItem value="30days">Last 30 Days</SelectItem>
                        <SelectItem value="90days">Last 90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select defaultValue="all">
                      <SelectTrigger>
                        <SelectValue placeholder="Select Report Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Measurements</SelectItem>
                        <SelectItem value="bp">Blood Pressure Only</SelectItem>
                        <SelectItem value="glucose">Glucose Only</SelectItem>
                        <SelectItem value="custom">Custom Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button className="w-full">Update Reports</Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Saved Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <div className="font-medium">Monthly BP Summary</div>
                        <div className="text-sm text-muted-foreground">Apr 1 - Apr 30, 2025</div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <div className="font-medium">Quarterly Health Checkup</div>
                        <div className="text-sm text-muted-foreground">Jan - Mar 2025</div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-center py-2">
                      <div>
                        <div className="font-medium">Medication Effectiveness</div>
                        <div className="text-sm text-muted-foreground">Last 14 days</div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Add Device Dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>
              Pair a new medical device with the monitoring system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device-type">Device Type</Label>
              <Select defaultValue="bp">
                <SelectTrigger>
                  <SelectValue placeholder="Select Device Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bp">Blood Pressure Monitor</SelectItem>
                  <SelectItem value="glucose">Glucose Monitor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="device-model">Device Model</Label>
              <Select defaultValue="ihealth">
                <SelectTrigger>
                  <SelectValue placeholder="Select Device Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ihealth">iHealth Track Connected</SelectItem>
                  <SelectItem value="wellue">Wellue BP2A Wireless</SelectItem>
                  <SelectItem value="caresens">CareSens N Plus</SelectItem>
                  <SelectItem value="gluneo">GluNEO Smart GDH-FAD</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="device-name">Custom Device Name (Optional)</Label>
              <Input id="device-name" placeholder="e.g. Living Room BP Monitor" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDevice(false)}>Cancel</Button>
            <Button onClick={() => pairDevice("bp", "iHealth Track Connected")}>
              <Bluetooth className="h-4 w-4 mr-2" />
              Start Pairing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Configure Device Dialog */}
      <Dialog open={showConfigureDevice} onOpenChange={setShowConfigureDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Device</DialogTitle>
            <DialogDescription>
              {selectedDevice?.name} settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device-rename">Device Name</Label>
              <Input id="device-rename" defaultValue={selectedDevice?.name} />
            </div>
            
            <div className="space-y-2">
              <Label>Measurement Schedule</Label>
              <Select defaultValue="manual">
                <SelectTrigger>
                  <SelectValue placeholder="Select Schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Only</SelectItem>
                  <SelectItem value="morning">Morning Reminder</SelectItem>
                  <SelectItem value="evening">Evening Reminder</SelectItem>
                  <SelectItem value="both">Morning & Evening</SelectItem>
                  <SelectItem value="custom">Custom Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Sync Frequency</Label>
              <Select defaultValue="auto">
                <SelectTrigger>
                  <SelectValue placeholder="Select Sync Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic (Real-time)</SelectItem>
                  <SelectItem value="daily">Once Daily</SelectItem>
                  <SelectItem value="manual">Manual Sync Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-sync">Auto Sync on Connection</Label>
              <Switch id="auto-sync" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-upload">Auto Upload to Cloud</Label>
              <Switch id="auto-upload" defaultChecked />
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" type="button" onClick={() => setShowConfigureDevice(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" type="button">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Device
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Alert Settings Dialog */}
      <Dialog open={showAlertSettings} onOpenChange={setShowAlertSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {alertType === "bp" ? "Blood Pressure Alert Settings" : "Glucose Alert Settings"}
            </DialogTitle>
            <DialogDescription>
              Configure when alerts should be triggered and how they are delivered.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {alertType === "bp" ? (
              <>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Systolic High Threshold (mmHg)</Label>
                      <span className="text-sm font-medium">{alertSettings.bp.systolicHigh}</span>
                    </div>
                    <Slider 
                      defaultValue={[alertSettings.bp.systolicHigh]} 
                      max={200} 
                      min={100} 
                      step={5}
                      onValueChange={(value) => {
                        setAlertSettings({
                          ...alertSettings,
                          bp: { ...alertSettings.bp, systolicHigh: value[0] }
                        })
                      }}
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Systolic Low Threshold (mmHg)</Label>
                      <span className="text-sm font-medium">{alertSettings.bp.systolicLow}</span>
                    </div>
                    <Slider 
                      defaultValue={[alertSettings.bp.systolicLow]} 
                      max={100} 
                      min={70} 
                      step={5}
                      onValueChange={(value) => {
                        setAlertSettings({
                          ...alertSettings,
                          bp: { ...alertSettings.bp, systolicLow: value[0] }
                        })
                      }}
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Diastolic High Threshold (mmHg)</Label>
                      <span className="text-sm font-medium">{alertSettings.bp.diastolicHigh}</span>
                    </div>
                    <Slider 
                      defaultValue={[alertSettings.bp.diastolicHigh]} 
                      max={120} 
                      min={70} 
                      step={5}
                      onValueChange={(value) => {
                        setAlertSettings({
                          ...alertSettings,
                          bp: { ...alertSettings.bp, diastolicHigh: value[0] }
                        })
                      }}
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Diastolic Low Threshold (mmHg)</Label>
                      <span className="text-sm font-medium">{alertSettings.bp.diastolicLow}</span>
                    </div>
                    <Slider 
                      defaultValue={[alertSettings.bp.diastolicLow]} 
                      max={70} 
                      min={40} 
                      step={5}
                      onValueChange={(value) => {
                        setAlertSettings({
                          ...alertSettings,
                          bp: { ...alertSettings.bp, diastolicLow: value[0] }
                        })
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Fasting High Threshold (mg/dL)</Label>
                      <span className="text-sm font-medium">{alertSettings.glucose.fastingHigh}</span>
                    </div>
                    <Slider 
                      defaultValue={[alertSettings.glucose.fastingHigh]} 
                      max={200} 
                      min={100} 
                      step={5}
                      onValueChange={(value) => {
                        setAlertSettings({
                          ...alertSettings,
                          glucose: { ...alertSettings.glucose, fastingHigh: value[0] }
                        })
                      }}
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Fasting Low Threshold (mg/dL)</Label>
                      <span className="text-sm font-medium">{alertSettings.glucose.fastingLow}</span>
                    </div>
                    <Slider 
                      defaultValue={[alertSettings.glucose.fastingLow]} 
                      max={80} 
                      min={50} 
                      step={5}
                      onValueChange={(value) => {
                        setAlertSettings({
                          ...alertSettings,
                          glucose: { ...alertSettings.glucose, fastingLow: value[0] }
                        })
                      }}
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Post-Meal High Threshold (mg/dL)</Label>
                      <span className="text-sm font-medium">{alertSettings.glucose.postMealHigh}</span>
                    </div>
                    <Slider 
                      defaultValue={[alertSettings.glucose.postMealHigh]} 
                      max={250} 
                      min={140} 
                      step={5}
                      onValueChange={(value) => {
                        setAlertSettings({
                          ...alertSettings,
                          glucose: { ...alertSettings.glucose, postMealHigh: value[0] }
                        })
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            
            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="alerts-enabled">Enable Alerts</Label>
                <Switch 
                  id="alerts-enabled" 
                  checked={alertType === "bp" ? alertSettings.bp.enabled : alertSettings.glucose.enabled}
                  onCheckedChange={(checked) => {
                    if (alertType === "bp") {
                      setAlertSettings({
                        ...alertSettings,
                        bp: { ...alertSettings.bp, enabled: checked }
                      });
                    } else {
                      setAlertSettings({
                        ...alertSettings,
                        glucose: { ...alertSettings.glucose, enabled: checked }
                      });
                    }
                  }}
                />
              </div>
              
              <div className="space-y-1">
                <Label>Alert Recipients</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notify-patient" defaultChecked />
                    <label htmlFor="notify-patient" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Patient
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notify-doctor" defaultChecked />
                    <label htmlFor="notify-doctor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Doctor
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notify-caregiver" />
                    <label htmlFor="notify-caregiver" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Caregiver
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notify-family" />
                    <label htmlFor="notify-family" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Family
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertSettings(false)}>Cancel</Button>
            <Button onClick={() => {
              setShowAlertSettings(false);
              toast({
                title: "Alert Settings Updated",
                description: `Your ${alertType === "bp" ? "blood pressure" : "glucose"} alert settings have been saved.`,
              });
            }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}