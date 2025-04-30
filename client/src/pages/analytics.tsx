import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign,
  Activity,
  Heart,
  BarChart2,
  Filter,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { format, addDays, subDays, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { DateRange } from "react-day-picker";

// Sample health data for visualization
const healthData = {
  bloodPressure: [
    { date: '2023-01-01', systolic: 122, diastolic: 85, pulse: 75 },
    { date: '2023-01-02', systolic: 125, diastolic: 82, pulse: 72 },
    { date: '2023-01-03', systolic: 130, diastolic: 88, pulse: 78 },
    { date: '2023-01-04', systolic: 128, diastolic: 86, pulse: 74 },
    { date: '2023-01-05', systolic: 135, diastolic: 90, pulse: 80 },
    { date: '2023-01-06', systolic: 129, diastolic: 84, pulse: 76 },
    { date: '2023-01-07', systolic: 124, diastolic: 83, pulse: 73 }
  ],
  glucose: [
    { date: '2023-01-01', value: 95, type: 'fasting' },
    { date: '2023-01-01', value: 145, type: 'post-meal' },
    { date: '2023-01-02', value: 98, type: 'fasting' },
    { date: '2023-01-02', value: 150, type: 'post-meal' },
    { date: '2023-01-03', value: 92, type: 'fasting' },
    { date: '2023-01-03', value: 138, type: 'post-meal' },
    { date: '2023-01-04', value: 97, type: 'fasting' },
    { date: '2023-01-04', value: 142, type: 'post-meal' }
  ],
  demographics: [
    { name: '18-30', value: 20 },
    { name: '31-45', value: 35 },
    { name: '46-60', value: 25 },
    { name: '60+', value: 20 }
  ],
  conditions: [
    { name: 'Hypertension', value: 30 },
    { name: 'Diabetes', value: 25 },
    { name: 'Heart Disease', value: 15 },
    { name: 'Asthma', value: 10 },
    { name: 'Other', value: 20 }
  ],
  appointments: [
    { month: "Jan", count: 65 },
    { month: "Feb", count: 75 },
    { month: "Mar", count: 85 },
    { month: "Apr", count: 78 },
    { month: "May", count: 90 },
    { month: "Jun", count: 95 }
  ],
  revenue: [
    { month: "Jan", amount: 12500 },
    { month: "Feb", amount: 14200 },
    { month: "Mar", amount: 15800 },
    { month: "Apr", amount: 14900 },
    { month: "May", amount: 16500 },
    { month: "Jun", amount: 17200 }
  ],
  patientReadingsCorrelation: [
    { x: 122, y: 102, z: 80, name: 'Patient A' },
    { x: 134, y: 96, z: 60, name: 'Patient B' },
    { x: 145, y: 180, z: 70, name: 'Patient C' },
    { x: 156, y: 92, z: 50, name: 'Patient D' },
    { x: 127, y: 120, z: 90, name: 'Patient E' },
    { x: 138, y: 110, z: 85, name: 'Patient F' },
    { x: 118, y: 95, z: 75, name: 'Patient G' }
  ],
  deviceUsage: [
    { name: 'Blood Pressure', value: 65 },
    { name: 'Glucose', value: 35 }
  ]
};

// COLORS for charts
const CHART_COLORS = {
  blue: '#0070f3',
  red: '#ff4040',
  orange: '#ff9900',
  green: '#00c853',
  purple: '#7b2cbf',
  yellow: '#ffcf00',
  blueVariants: ['#0070f3', '#0099ff', '#66c2ff', '#b3e0ff'],
  redVariants: ['#ff4040', '#ff6666', '#ff9999', '#ffcccc'],
  greenVariants: ['#00c853', '#66d98d', '#99e6b3', '#ccf2d9'],
  medicalColors: ['#32506a', '#4A89DC', '#5D9CEC', '#967ADC', '#D770AD', '#ff6b6b', '#ffad60', '#ffd460', '#8cce5e']
};

// Helper function to format date for charts
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return format(date, 'MMM dd');
};

const today = new Date();
const defaultDateRange: DateRange = {
  from: subDays(today, 30),
  to: today
};

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [patientFilter, setPatientFilter] = useState("all");
  const [selectedDemographic, setSelectedDemographic] = useState("age");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  
  // Fetch patients for filtering
  const { data: patients } = useQuery({
    queryKey: ['/api/patients'],
    select: (data) => data || []
  });
  
  // Fetch patient health data (for when we have actual APIs)
  // const { data: bpReadings, isLoading: isLoadingBp } = useQuery({
  //   queryKey: ['/api/analytics/bp-readings', selectedPatientId, dateRange],
  //   queryFn: async () => {
  //     const from = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  //     const to = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';
  //     const response = await fetch(`/api/analytics/bp-readings?patientId=${selectedPatientId || 'all'}&from=${from}&to=${to}`);
  //     if (!response.ok) throw new Error('Failed to fetch BP readings');
  //     return response.json();
  //   },
  //   enabled: !!dateRange?.from && !!dateRange?.to
  // });
  
  // Formatted data for BP chart
  const formattedBpData = healthData.bloodPressure.map(reading => ({
    ...reading,
    formattedDate: formatDate(reading.date)
  }));
  
  // Formatted data for glucose chart
  const formattedGlucoseData = healthData.glucose.map(reading => ({
    ...reading,
    formattedDate: formatDate(reading.date)
  }));
  
  // Function to handle exporting data
  const handleExportData = (type: string) => {
    toast({
      title: "Exporting Data",
      description: `${type} data is being exported.`
    });
    
    // In a real app, this would trigger an actual download
    console.log(`Exporting ${type} data`);
  };
  
  // Function to calculate health score (example algorithm)
  const calculateHealthScore = (bpData: any[], glucoseData: any[]) => {
    if (!bpData.length && !glucoseData.length) return 0;
    
    // Simplified scoring based on latest readings
    const latestBp = bpData[bpData.length - 1];
    let bpScore = 0;
    
    if (latestBp) {
      // BP scoring (0-100)
      const systolicScore = latestBp.systolic < 120 ? 100 :
                           latestBp.systolic < 130 ? 90 :
                           latestBp.systolic < 140 ? 70 :
                           latestBp.systolic < 160 ? 50 : 30;
                           
      const diastolicScore = latestBp.diastolic < 80 ? 100 :
                            latestBp.diastolic < 85 ? 90 :
                            latestBp.diastolic < 90 ? 70 :
                            latestBp.diastolic < 100 ? 50 : 30;
                            
      bpScore = (systolicScore + diastolicScore) / 2;
    }
    
    // Glucose scoring
    const latestGlucose = glucoseData.filter(g => g.type === 'fasting')[0];
    let glucoseScore = 0;
    
    if (latestGlucose) {
      glucoseScore = latestGlucose.value < 100 ? 100 :
                    latestGlucose.value < 120 ? 80 :
                    latestGlucose.value < 140 ? 60 : 40;
    }
    
    // Calculate overall score
    if (bpScore && glucoseScore) {
      return Math.round((bpScore + glucoseScore) / 2);
    } else {
      return Math.round(bpScore || glucoseScore);
    }
  };
  
  const healthScore = calculateHealthScore(healthData.bloodPressure, healthData.glucose);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Interactive Analytics</h1>
          <p className="text-muted-foreground">Comprehensive health and practice insights dashboard</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <DatePickerWithRange 
            date={dateRange} 
            onDateChange={setDateRange} 
            className="w-[300px]" 
          />
          
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Heart className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthScore}/100</div>
            <div className="mt-1 flex items-center">
              <Badge className="bg-blue-800">{healthScore > 75 ? 'Excellent' : healthScore > 60 ? 'Good' : 'Needs Attention'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patient Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2,350</div>
            <p className="text-xs text-muted-foreground">+15.2% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Readings</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthData.bloodPressure.length + healthData.glucose.length}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$17,200</div>
            <p className="text-xs text-muted-foreground">+4.3% from last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Blood Pressure Trends</CardTitle>
              <div className="flex space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-muted-foreground">Systolic</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-sm text-muted-foreground">Diastolic</span>
                </div>
              </div>
            </div>
            <CardDescription>
              Track blood pressure readings over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={formattedBpData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="formattedDate" />
                  <YAxis domain={[60, 160]} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }} />
                  <Legend />
                  <ReferenceLine y={140} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'High', fill: 'red', fontSize: 12 }} />
                  <ReferenceLine y={90} stroke="green" strokeDasharray="3 3" label={{ position: 'top', value: 'Normal', fill: 'green', fontSize: 12 }} />
                  <Line 
                    type="monotone" 
                    dataKey="systolic" 
                    stroke={CHART_COLORS.blue} 
                    activeDot={{ r: 8 }} 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="diastolic" 
                    stroke={CHART_COLORS.red} 
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Glucose Monitoring</CardTitle>
              <div className="flex space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">Fasting</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <span className="text-sm text-muted-foreground">Post-meal</span>
                </div>
              </div>
            </div>
            <CardDescription>
              Compare fasting and post-meal glucose levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={formattedGlucoseData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="formattedDate" />
                  <YAxis domain={[70, 200]} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }} />
                  <Legend />
                  <ReferenceLine y={140} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'High', fill: 'red', fontSize: 12 }} />
                  <ReferenceLine y={100} stroke="green" strokeDasharray="3 3" label={{ position: 'top', value: 'Normal', fill: 'green', fontSize: 12 }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    fill={CHART_COLORS.green} 
                    stroke={CHART_COLORS.green}
                    fillOpacity={0.3}
                    name="Glucose"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="grid grid-cols-4 md:w-[600px]">
          <TabsTrigger value="health">Health Analytics</TabsTrigger>
          <TabsTrigger value="patients">Patient Analytics</TabsTrigger>
          <TabsTrigger value="practice">Practice Analytics</TabsTrigger>
          <TabsTrigger value="devices">Device Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Health Parameter Correlation</CardTitle>
                <CardDescription>Relationship between systolic BP and glucose levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <CartesianGrid />
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name="Systolic BP" 
                        domain={[100, 160]} 
                        label={{ value: 'Systolic BP (mmHg)', position: 'bottom', offset: 0 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name="Glucose" 
                        domain={[80, 200]} 
                        label={{ value: 'Glucose (mg/dL)', angle: -90, position: 'left' }}
                      />
                      <ZAxis 
                        type="number" 
                        dataKey="z" 
                        range={[100, 500]} 
                        name="Age"
                      />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Legend />
                      <Scatter 
                        name="Patients" 
                        data={healthData.patientReadingsCorrelation} 
                        fill={CHART_COLORS.blue}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Risk Analysis</CardTitle>
                <CardDescription>Health risk categorization of patients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthData.conditions}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={130}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {healthData.conditions.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS.medicalColors[index % CHART_COLORS.medicalColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patients">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Patient Demographics</CardTitle>
                  <Select 
                    value={selectedDemographic} 
                    onValueChange={setSelectedDemographic}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select demographic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="age">Age Distribution</SelectItem>
                      <SelectItem value="gender">Gender Distribution</SelectItem>
                      <SelectItem value="location">Geographic Distribution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription>Breakdown of patient demographics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthData.demographics}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={130}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {healthData.demographics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS.blueVariants[index % CHART_COLORS.blueVariants.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Patient Engagement</CardTitle>
                <CardDescription>Monitoring frequency and appointment adherence</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {name: 'Daily', engagement: 30},
                        {name: 'Weekly', engagement: 45},
                        {name: 'Monthly', engagement: 20},
                        {name: 'Irregular', engagement: 5}
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="engagement" name="Patients (%)" fill={CHART_COLORS.blue} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="practice">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Trends</CardTitle>
                <CardDescription>Monthly appointment statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={healthData.appointments}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="Appointments" fill={CHART_COLORS.green} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analysis</CardTitle>
                <CardDescription>Monthly revenue trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={healthData.revenue}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                      <Legend />
                      <Line type="monotone" dataKey="amount" name="Revenue" stroke={CHART_COLORS.blue} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="devices">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Device Type Distribution</CardTitle>
                <CardDescription>Types of connected medical devices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthData.deviceUsage}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={130}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {healthData.deviceUsage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? CHART_COLORS.blue : CHART_COLORS.green} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Device Reading Frequency</CardTitle>
                <CardDescription>How often patients use their monitoring devices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {name: 'Daily', bp: 40, glucose: 30},
                        {name: 'Weekly', bp: 30, glucose: 35},
                        {name: 'Monthly', bp: 20, glucose: 25},
                        {name: 'Irregular', bp: 10, glucose: 10}
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="bp" name="Blood Pressure" fill={CHART_COLORS.blue} />
                      <Bar dataKey="glucose" name="Glucose" fill={CHART_COLORS.green} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center pt-2">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" /> Filters
          </Button>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="show-anomalies"
              checked={showAnomalies}
              onCheckedChange={setShowAnomalies}
            />
            <Label htmlFor="show-anomalies">Show Anomalies</Label>
          </div>
        </div>
        
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExportData('csv')}>Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExportData('pdf')}>Export PDF</Button>
          <Button size="sm" onClick={() => handleExportData('raw')}>Export Raw Data</Button>
        </div>
      </div>
    </div>
  );
}
