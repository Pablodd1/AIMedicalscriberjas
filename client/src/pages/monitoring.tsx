import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Activity, Plus, Trash, Bluetooth } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import BluetoothConnect from '@/components/bluetooth-connect';

const PatientSelector = ({ patients, selectedPatientId, onSelectPatient }: {
  patients: any[],
  selectedPatientId: number | null,
  onSelectPatient: (id: number) => void
}) => {
  if (!patients?.length) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No patients available</AlertTitle>
        <AlertDescription>
          You need to add patients before you can monitor their health data.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mb-6">
      <Label htmlFor="patientSelect">Select Patient</Label>
      <Select
        value={selectedPatientId?.toString() || ''}
        onValueChange={(value) => onSelectPatient(parseInt(value))}
      >
        <SelectTrigger id="patientSelect">
          <SelectValue placeholder="Select a patient" />
        </SelectTrigger>
        <SelectContent>
          {patients.map((patient) => (
            <SelectItem key={patient.id} value={patient.id.toString()}>
              {patient.firstName} {patient.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const DeviceCard = ({ device, onDelete, onAddReading }: {
  device: any,
  onDelete: (id: number) => void,
  onAddReading: (device: any) => void
}) => {
  const statusColors = {
    connected: 'bg-green-500',
    disconnected: 'bg-red-500',
    pairing: 'bg-yellow-500'
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{device.name}</CardTitle>
            <CardDescription>{device.model}</CardDescription>
          </div>
          <Badge className={statusColors[device.status as keyof typeof statusColors] || 'bg-gray-500'}>
            {device.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-sm text-gray-500">
          <div>Type: {device.type === 'bp' ? 'Blood Pressure Monitor' : 'Glucose Meter'}</div>
          <div>Last Connected: {device.lastConnected ? new Date(device.lastConnected).toLocaleString() : 'Never'}</div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={() => onDelete(device.id)}>
          <Trash className="h-4 w-4 mr-2" />
          Remove
        </Button>
        <Button size="sm" onClick={() => onAddReading(device)}>
          <Activity className="h-4 w-4 mr-2" />
          Add Reading
        </Button>
      </CardFooter>
    </Card>
  );
};

const AddDeviceDialog = ({ patientId, isOpen, onClose, onAdd }: {
  patientId: number | null,
  isOpen: boolean,
  onClose: () => void,
  onAdd: (data: any) => void
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'bp',
    model: '',
    status: 'disconnected'
  });

  const handleChange = (field: any, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onAdd({ ...formData, patientId });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
          <DialogDescription>
            Enter the details of the FDA-cleared medical device you want to add.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleChange('type', value)}
              >
                <SelectTrigger id="type" className="col-span-3">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bp">Blood Pressure Monitor</SelectItem>
                  <SelectItem value="glucose">Glucose Meter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="model" className="text-right">
                Model
              </Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
              >
                <SelectTrigger id="status" className="col-span-3">
                  <SelectValue placeholder="Select device status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="disconnected">Disconnected</SelectItem>
                  <SelectItem value="pairing">Pairing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Add Device</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddReadingDialog = ({ device, isOpen, onClose, onAdd }: {
  device: any,
  isOpen: boolean,
  onClose: () => void,
  onAdd: (data: any, type: string) => void
}) => {
  const [formData, setFormData] = useState(
    device?.type === 'bp'
      ? { systolic: '', diastolic: '', pulse: '', notes: '' }
      : { value: '', type: 'random', notes: '' }
  );

  const handleChange = (field: any, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();

    // For BP readings
    if (device?.type === 'bp') {
      onAdd({
        deviceId: device.id,
        patientId: device.patientId,
        systolic: parseInt((formData as any).systolic || '0'),
        diastolic: parseInt((formData as any).diastolic || '0'),
        pulse: parseInt((formData as any).pulse || '0'),
        notes: (formData as any).notes
      }, 'bp');
    }
    // For glucose readings
    else {
      onAdd({
        deviceId: device.id,
        patientId: device.patientId,
        value: parseInt((formData as any).value || '0'),
        type: (formData as any).type,
        notes: (formData as any).notes
      }, 'glucose');
    }

    onClose();
  };

  if (!device) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Reading</DialogTitle>
          <DialogDescription>
            {device.type === 'bp'
              ? 'Enter blood pressure and pulse information.'
              : 'Enter blood glucose reading details.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Blood Pressure Form Fields */}
            {device.type === 'bp' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="systolic" className="text-right">
                    Systolic (mmHg)
                  </Label>
                  <Input
                    id="systolic"
                    value={formData.systolic}
                    onChange={(e) => handleChange('systolic', e.target.value)}
                    className="col-span-3"
                    type="number"
                    required
                    min="70"
                    max="250"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="diastolic" className="text-right">
                    Diastolic (mmHg)
                  </Label>
                  <Input
                    id="diastolic"
                    value={formData.diastolic}
                    onChange={(e) => handleChange('diastolic', e.target.value)}
                    className="col-span-3"
                    type="number"
                    required
                    min="40"
                    max="180"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="pulse" className="text-right">
                    Pulse (bpm)
                  </Label>
                  <Input
                    id="pulse"
                    value={formData.pulse}
                    onChange={(e) => handleChange('pulse', e.target.value)}
                    className="col-span-3"
                    type="number"
                    required
                    min="30"
                    max="220"
                  />
                </div>
              </>
            )}

            {/* Glucose Form Fields */}
            {device.type === 'glucose' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="value" className="text-right">
                    Glucose (mg/dL)
                  </Label>
                  <Input
                    id="value"
                    value={formData.value}
                    onChange={(e) => handleChange('value', e.target.value)}
                    className="col-span-3"
                    type="number"
                    required
                    min="20"
                    max="600"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Reading Type
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => handleChange('type', value)}
                  >
                    <SelectTrigger id="type" className="col-span-3">
                      <SelectValue placeholder="Select reading type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fasting">Fasting</SelectItem>
                      <SelectItem value="pre-meal">Pre-Meal</SelectItem>
                      <SelectItem value="post-meal">Post-Meal</SelectItem>
                      <SelectItem value="random">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Common Fields */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save Reading</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ReadingsTab = ({ readings, type }: {
  readings: any[],
  type: string
}) => {
  if (!readings || readings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No readings available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {type === 'bp' ? (
        // BP Readings
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Systolic</th>
                <th className="px-4 py-2 text-left">Diastolic</th>
                <th className="px-4 py-2 text-left">Pulse</th>
                <th className="px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id} className="border-b">
                  <td className="px-4 py-2">{new Date(reading.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">{reading.systolic} mmHg</td>
                  <td className="px-4 py-2">{reading.diastolic} mmHg</td>
                  <td className="px-4 py-2">{reading.pulse} bpm</td>
                  <td className="px-4 py-2">{reading.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Glucose Readings
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Glucose</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id} className="border-b">
                  <td className="px-4 py-2">{new Date(reading.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">{reading.value} mg/dL</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline">{reading.type}</Badge>
                  </td>
                  <td className="px-4 py-2">{reading.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AlertSettingsDialog = ({ patientId, deviceType, isOpen, onClose, onSave }: {
  patientId: number | null,
  deviceType: string,
  isOpen: boolean,
  onClose: () => void,
  onSave: (data: any) => void
}) => {
  const { toast } = useToast();

  // Fetch existing settings if available
  const { data: existingSettings } = useQuery({
    queryKey: ['/api/monitoring/alert-settings', patientId, deviceType],
    queryFn: async () => {
      if (!patientId || !deviceType) return null;

      try {
        const response = await fetch(`/api/monitoring/alert-settings/${patientId}/${deviceType}`);
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        console.error('Failed to fetch alert settings:', error);
        return null;
      }
    },
    enabled: !!patientId && !!deviceType && isOpen
  });

  const [formData, setFormData] = useState({
    patientId,
    deviceType,
    thresholds: deviceType === 'bp'
      ? { systolicHigh: 140, systolicLow: 90, diastolicHigh: 90, diastolicLow: 60, pulseHigh: 100, pulseLow: 60 }
      : { high: 180, low: 70 },
    notifyPatient: true,
    notifyDoctor: true,
    notifyCaregivers: false,
    notifyFamily: false,
    enabled: true
  });

  // Update form with existing settings when available
  React.useEffect(() => {
    if (existingSettings) {
      setFormData(existingSettings);
    }
  }, [existingSettings]);

  const handleThresholdChange = (field: any, value: any) => {
    setFormData(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [field]: parseInt(value)
      }
    }));
  };

  const handleChange = (field: any, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();

    onSave({
      ...formData,
      patientId,
      deviceType
    });

    toast({
      title: "Alert settings saved",
      description: "Your alert threshold settings have been successfully saved."
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Alert Thresholds</DialogTitle>
          <DialogDescription>
            Set thresholds for when alerts should be triggered for abnormal readings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {deviceType === 'bp' ? (
              /* Blood Pressure Thresholds */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="systolicHigh">Systolic High (mmHg)</Label>
                    <Input
                      id="systolicHigh"
                      type="number"
                      value={formData.thresholds.systolicHigh}
                      onChange={(e) => handleThresholdChange('systolicHigh', e.target.value)}
                      min="100"
                      max="220"
                    />
                  </div>
                  <div>
                    <Label htmlFor="systolicLow">Systolic Low (mmHg)</Label>
                    <Input
                      id="systolicLow"
                      type="number"
                      value={formData.thresholds.systolicLow}
                      onChange={(e) => handleThresholdChange('systolicLow', e.target.value)}
                      min="70"
                      max="140"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="diastolicHigh">Diastolic High (mmHg)</Label>
                    <Input
                      id="diastolicHigh"
                      type="number"
                      value={formData.thresholds.diastolicHigh}
                      onChange={(e) => handleThresholdChange('diastolicHigh', e.target.value)}
                      min="70"
                      max="120"
                    />
                  </div>
                  <div>
                    <Label htmlFor="diastolicLow">Diastolic Low (mmHg)</Label>
                    <Input
                      id="diastolicLow"
                      type="number"
                      value={formData.thresholds.diastolicLow}
                      onChange={(e) => handleThresholdChange('diastolicLow', e.target.value)}
                      min="40"
                      max="80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pulseHigh">Pulse High (bpm)</Label>
                    <Input
                      id="pulseHigh"
                      type="number"
                      value={formData.thresholds.pulseHigh}
                      onChange={(e) => handleThresholdChange('pulseHigh', e.target.value)}
                      min="80"
                      max="200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pulseLow">Pulse Low (bpm)</Label>
                    <Input
                      id="pulseLow"
                      type="number"
                      value={formData.thresholds.pulseLow}
                      onChange={(e) => handleThresholdChange('pulseLow', e.target.value)}
                      min="40"
                      max="70"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Glucose Thresholds */
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="high">Glucose High (mg/dL)</Label>
                  <Input
                    id="high"
                    type="number"
                    value={formData.thresholds.high}
                    onChange={(e) => handleThresholdChange('high', e.target.value)}
                    min="120"
                    max="300"
                  />
                </div>
                <div>
                  <Label htmlFor="low">Glucose Low (mg/dL)</Label>
                  <Input
                    id="low"
                    type="number"
                    value={formData.thresholds.low}
                    onChange={(e) => handleThresholdChange('low', e.target.value)}
                    min="40"
                    max="100"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2 pt-4">
              <h4 className="text-sm font-medium">Notification Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="notifyPatient"
                    checked={formData.notifyPatient}
                    onChange={(e) => handleChange('notifyPatient', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="notifyPatient">Notify Patient</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="notifyDoctor"
                    checked={formData.notifyDoctor}
                    onChange={(e) => handleChange('notifyDoctor', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="notifyDoctor">Notify Doctor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="notifyCaregivers"
                    checked={formData.notifyCaregivers}
                    onChange={(e) => handleChange('notifyCaregivers', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="notifyCaregivers">Notify Caregivers</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="notifyFamily"
                    checked={formData.notifyFamily}
                    onChange={(e) => handleChange('notifyFamily', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="notifyFamily">Notify Family</Label>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-4">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="enabled">Enable Alerts</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Save Settings</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function MonitoringPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [isAddDeviceDialogOpen, setIsAddDeviceDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isAddReadingDialogOpen, setIsAddReadingDialogOpen] = useState(false);
  const [activeTabType, setActiveTabType] = useState<'bp' | 'glucose'>('bp');
  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState(false);

  // Fetch patients data
  const { data: patients, isLoading: isLoadingPatients } = useQuery<any[]>({
    queryKey: ['/api/patients'],
    select: (data: any) => data || []
  });

  // Fetch devices for selected patient
  const { data: devices, isLoading: isLoadingDevices } = useQuery<any[]>({
    queryKey: ['/api/monitoring/devices', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const response = await fetch(`/api/monitoring/devices/${selectedPatientId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }
      return response.json();
    },
    enabled: !!selectedPatientId
  });

  // Fetch BP readings for selected patient
  const { data: bpReadings, isLoading: isLoadingBpReadings } = useQuery({
    queryKey: ['/api/monitoring/bp-readings', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const response = await fetch(`/api/monitoring/bp-readings/${selectedPatientId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch BP readings');
      }
      return response.json();
    },
    enabled: !!selectedPatientId
  });

  // Fetch glucose readings for selected patient
  const { data: glucoseReadings, isLoading: isLoadingGlucoseReadings } = useQuery({
    queryKey: ['/api/monitoring/glucose-readings', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const response = await fetch(`/api/monitoring/glucose-readings/${selectedPatientId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch glucose readings');
      }
      return response.json();
    },
    enabled: !!selectedPatientId
  });

  // Set first patient as selected if none is selected
  React.useEffect(() => {
    if (patients?.length && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  // Handle adding a new device
  const handleAddDevice = async (deviceData: any) => {
    try {
      const response = await fetch('/api/monitoring/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deviceData),
      });

      if (!response.ok) {
        throw new Error('Failed to add device');
      }

      // Invalidate device query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/devices', selectedPatientId] });

      toast({
        title: 'Device Added',
        description: 'The device has been successfully added.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || "An error occurred",
        variant: 'destructive',
      });
    }
  };

  // Handle deleting a device
  const handleDeleteDevice = async (deviceId: number) => {
    try {
      const response = await fetch(`/api/monitoring/device/${deviceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete device');
      }

      // Invalidate device query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/devices', selectedPatientId] });

      toast({
        title: 'Device Removed',
        description: 'The device has been successfully removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || "An error occurred",
        variant: 'destructive',
      });
    }
  };

  // Handle adding a reading
  const handleAddReading = async (readingData: any, type: any) => {
    try {
      const endpoint = type === 'bp' ? '/api/monitoring/bp-reading' : '/api/monitoring/glucose-reading';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(readingData),
      });

      if (!response.ok) {
        throw new Error(`Failed to add ${type === 'bp' ? 'blood pressure' : 'glucose'} reading`);
      }

      // Invalidate readings queries to refetch the updated list
      if (type === 'bp') {
        queryClient.invalidateQueries({ queryKey: ['/api/monitoring/bp-readings', selectedPatientId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/monitoring/glucose-readings', selectedPatientId] });
      }

      toast({
        title: 'Reading Added',
        description: `The ${type === 'bp' ? 'blood pressure' : 'glucose'} reading has been successfully added.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || "An error occurred",
        variant: 'destructive',
      });
    }
  };

  // Handle saving alert settings
  const handleSaveAlertSettings = async (settingsData: any) => {
    try {
      const response = await fetch('/api/monitoring/alert-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsData),
      });

      if (!response.ok) {
        throw new Error('Failed to save alert settings');
      }

      // Invalidate alert settings query
      queryClient.invalidateQueries({
        queryKey: ['/api/monitoring/alert-settings', selectedPatientId, activeTabType]
      });

      toast({
        title: 'Settings Saved',
        description: 'Alert thresholds have been successfully saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || "An error occurred",
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Patient Monitoring</h1>
          <p className="text-gray-500">
            Track and manage patient health metrics from FDA-cleared devices
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsAlertSettingsOpen(true)}
            disabled={!selectedPatientId}
          >
            Configure Alerts
          </Button>
          <Button
            onClick={() => setIsAddDeviceDialogOpen(true)}
            disabled={!selectedPatientId}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Device
          </Button>
        </div>
      </div>

      <PatientSelector
        patients={patients || []}
        selectedPatientId={selectedPatientId}
        onSelectPatient={setSelectedPatientId}
      />

      {selectedPatientId && (
        <Tabs defaultValue="devices" className="mt-6">
          <TabsList>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="readings">Readings</TabsTrigger>
          </TabsList>

          <TabsContent value="devices">
            {selectedPatientId && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Bluetooth Integration</CardTitle>
                  <CardDescription>
                    Connect to FDA-cleared medical devices via Bluetooth to automatically record readings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="bp">
                    <TabsList className="mb-4">
                      <TabsTrigger value="bp">Blood Pressure Monitor</TabsTrigger>
                      <TabsTrigger value="glucose">Glucose Meter</TabsTrigger>
                    </TabsList>

                    <TabsContent value="bp">
                      <BluetoothConnect
                        patientId={selectedPatientId}
                        deviceType="bp"
                        onDeviceConnected={handleAddDevice}
                        onReadingReceived={(readingData) => handleAddReading(readingData, 'bp')}
                      />
                    </TabsContent>

                    <TabsContent value="glucose">
                      <BluetoothConnect
                        patientId={selectedPatientId}
                        deviceType="glucose"
                        onDeviceConnected={handleAddDevice}
                        onReadingReceived={(readingData) => handleAddReading(readingData, 'glucose')}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {devices?.map((device: any) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onDelete={handleDeleteDevice}
                  onAddReading={(device: any) => {
                    setSelectedDevice(device);
                    setIsAddReadingDialogOpen(true);
                  }}
                />
              ))}

              {!isLoadingDevices && (!devices || devices.length === 0) && (
                <div className="col-span-full text-center py-10">
                  <p className="text-gray-500 mb-4">No devices added yet</p>
                  <Button onClick={() => setIsAddDeviceDialogOpen(true)}>
                    Add Your First Device
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="readings">
            <Tabs defaultValue="bp" className="mt-6" onValueChange={(value) => setActiveTabType(value as 'bp' | 'glucose')}>
              <TabsList>
                <TabsTrigger value="bp">Blood Pressure</TabsTrigger>
                <TabsTrigger value="glucose">Glucose</TabsTrigger>
              </TabsList>

              <TabsContent value="bp">
                <ReadingsTab readings={bpReadings} type="bp" />
              </TabsContent>

              <TabsContent value="glucose">
                <ReadingsTab readings={glucoseReadings} type="glucose" />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      )}

      {/* Add Device Dialog */}
      {selectedPatientId && (
        <AddDeviceDialog
          patientId={selectedPatientId}
          isOpen={isAddDeviceDialogOpen}
          onClose={() => setIsAddDeviceDialogOpen(false)}
          onAdd={handleAddDevice}
        />
      )}

      {/* Add Reading Dialog */}
      {selectedDevice && (
        <AddReadingDialog
          device={selectedDevice}
          isOpen={isAddReadingDialogOpen}
          onClose={() => {
            setIsAddReadingDialogOpen(false);
            setSelectedDevice(null);
          }}
          onAdd={handleAddReading}
        />
      )}

      {/* Alert Settings Dialog */}
      {selectedPatientId && (
        <AlertSettingsDialog
          patientId={selectedPatientId}
          deviceType={activeTabType}
          isOpen={isAlertSettingsOpen}
          onClose={() => setIsAlertSettingsOpen(false)}
          onSave={handleSaveAlertSettings}
        />
      )}
    </div>
  );
}