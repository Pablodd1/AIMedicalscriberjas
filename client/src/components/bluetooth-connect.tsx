import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Activity, Bluetooth } from 'lucide-react';
import { 
  connectBloodPressureMonitor,
  connectGlucoseMeter,
  getDeviceInfo,
  isBluetoothAvailable,
  readBloodPressureData,
  readGlucoseData,
  requestDevice
} from '@/lib/bluetooth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface BluetoothConnectProps {
  patientId: number;
  deviceType: 'bp' | 'glucose';
  onDeviceConnected: (deviceData: any) => void;
  onReadingReceived: (readingData: any) => void;
}

export default function BluetoothConnect({
  patientId,
  deviceType,
  onDeviceConnected,
  onReadingReceived
}: BluetoothConnectProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{ manufacturer: string; model: string } | null>(null);
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [customDeviceName, setCustomDeviceName] = useState('');

  const connectDevice = async (allowAllDevices = false) => {
    if (!isBluetoothAvailable()) {
      toast({
        title: 'Bluetooth Not Available',
        description: 'Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.',
        variant: 'destructive',
      });
      return;
    }

    // Check if Bluetooth is powered on
    if (navigator.bluetooth.getAvailability) {
      const isAvailable = await navigator.bluetooth.getAvailability();
      if (!isAvailable) {
        toast({
          title: 'Bluetooth is Turned Off',
          description: 'Please turn on Bluetooth on your device and try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsConnecting(true);
    
    try {
      // Always use the most permissive approach that shows ALL devices
      toast({
        title: 'Bluetooth Pairing',
        description: 'Please select your device from the list when the dialog appears. Make sure your device is turned ON and in pairing mode.',
      });
      
      // Use connectBloodPressureMonitor for both options which now uses acceptAllDevices
      // to ensure maximum compatibility and device visibility
      const bluetoothDevice = await connectBloodPressureMonitor();
      
      if (bluetoothDevice) {
        // Success - device was selected
        setDevice(bluetoothDevice);
        console.log("Successfully connected to device:", bluetoothDevice.name || "Unnamed device");
        
        // Set basic device info immediately based on the name
        const deviceName = bluetoothDevice.name || 'Medical Device';
        const basicInfo = { 
          manufacturer: deviceName.split(' ')[0] || "Medical", 
          model: deviceName
        };
        setDeviceInfo(basicInfo);
        
        // Try to get more detailed device info if possible
        try {
          console.log("Attempting to get device info...");
          const server = await bluetoothDevice.gatt?.connect();
          if (server) {
            console.log("GATT server connected, trying to get device info");
            try {
              const info = await getDeviceInfo(bluetoothDevice);
              console.log("Device info retrieved:", info);
              // Only update if we got meaningful info
              if (info.manufacturer !== "Unknown" || info.model !== "Unknown") {
                setDeviceInfo(info);
              }
            } catch (infoError) {
              console.warn('Could not get detailed device info:', infoError);
              // Already set basic info above, so no need to set again
            }
          }
        } catch (gattError) {
          console.warn('Could not connect to GATT server for detailed info:', gattError);
          // Already set basic info above, so we can proceed
        }
        
        // Open dialog to customize device name
        const displayName = bluetoothDevice.name || 'Medical Device';
        setCustomDeviceName(displayName);
        setIsDeviceDialogOpen(true);
        
        toast({
          title: 'Device Connected',
          description: `Successfully connected to "${displayName}". You can now take readings.`,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: 'No device was selected or connection was cancelled. Please make sure your device is turned on, in pairing mode, and try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error connecting to device:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to connect to the device.';
      
      if (error.message?.includes('User cancelled')) {
        errorMessage = 'Device selection was cancelled. Please try again.';
      } else if (error.message?.includes('No Bluetooth device')) {
        errorMessage = 'No devices were found. Make sure Bluetooth is enabled on your device and your blood pressure monitor is turned on and in pairing mode.';
      } else if (error.message?.includes('GATT')) {
        errorMessage = 'Could not establish a secure connection with the device. Please try turning your device off and on again, then retry pairing.';
      } else if (error.message?.includes('Bluetooth adapter is not available')) {
        errorMessage = 'Your device\'s Bluetooth adapter is not available. Please make sure Bluetooth is turned on and permissions are granted.';
      }
      
      toast({
        title: 'Connection Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // State for manual input dialog
  const [showManualInputDialog, setShowManualInputDialog] = useState(false);
  const [manualReading, setManualReading] = useState({
    systolic: '120',
    diastolic: '80',
    pulse: '72'
  });

  const readData = async () => {
    if (!device) {
      toast({
        title: 'No Device Connected',
        description: 'Please connect to a device first.',
        variant: 'destructive',
      });
      return;
    }

    setIsReading(true);
    toast({
      title: 'Reading Device',
      description: 'Please activate your device measurement now...',
    });
    
    try {
      let readingData = null;
      
      if (deviceType === 'bp') {
        // Show progress indicator for blood pressure readings
        toast({
          title: 'Taking Blood Pressure',
          description: 'Please remain still while the measurement is in progress...',
        });
        
        try {
          readingData = await readBloodPressureData(device);
        } catch (readError) {
          console.error("Error in blood pressure reading:", readError);
          // Open the manual input dialog if reading fails
          setShowManualInputDialog(true);
          setIsReading(false);
          return;
        }
        
        if (readingData) {
          // Determine blood pressure category
          let category = "";
          const { systolic, diastolic } = readingData;
          
          if (systolic < 120 && diastolic < 80) {
            category = "Normal";
          } else if ((systolic >= 120 && systolic <= 129) && diastolic < 80) {
            category = "Elevated";
          } else if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
            category = "Stage 1 Hypertension";
          } else if (systolic >= 140 || diastolic >= 90) {
            category = "Stage 2 Hypertension";
          } else if (systolic > 180 || diastolic > 120) {
            category = "Hypertensive Crisis";
          }
          
          toast({
            title: 'Reading Success',
            description: `BP: ${readingData.systolic}/${readingData.diastolic} mmHg (${category}), Pulse: ${readingData.pulse} bpm`,
          });
          
          onReadingReceived({
            deviceId: device.id,
            patientId: patientId,
            systolic: readingData.systolic,
            diastolic: readingData.diastolic,
            pulse: readingData.pulse,
            notes: `Automated reading from ${device.name || 'Bluetooth device'} - ${category}`
          });
        } else {
          // Open the manual input dialog if reading fails
          setShowManualInputDialog(true);
          setIsReading(false);
          return;
        }
      } else {
        // Show progress indicator for glucose readings
        toast({
          title: 'Reading Glucose',
          description: 'Please place your test strip in the meter...',
        });
        
        readingData = await readGlucoseData(device);
        
        if (readingData) {
          // Determine glucose range
          let category = "";
          const { value, type } = readingData;
          
          if (type === "Fasting" || type === "Pre-meal") {
            if (value < 70) category = "Low";
            else if (value <= 100) category = "Normal";
            else if (value <= 125) category = "Prediabetes";
            else category = "Diabetes";
          } else {
            // Post-meal
            if (value < 70) category = "Low";
            else if (value <= 140) category = "Normal";
            else if (value <= 199) category = "Prediabetes";
            else category = "Diabetes";
          }
          
          toast({
            title: 'Reading Success',
            description: `Glucose: ${readingData.value} mg/dL (${category}) - ${readingData.type}`,
          });
          
          onReadingReceived({
            deviceId: device.id,
            patientId: patientId,
            value: readingData.value,
            type: readingData.type.toLowerCase(),
            notes: `Automated reading from ${device.name || 'Bluetooth device'} - ${category}`
          });
        }
      }
      
      if (!readingData) {
        // Open the manual input dialog if reading fails
        setShowManualInputDialog(true);
      }
    } catch (error) {
      console.error('Error reading data:', error);
      
      // Open the manual input dialog on error
      setShowManualInputDialog(true);
    } finally {
      setIsReading(false);
    }
  };
  
  const handleManualInputChange = (field: string, value: string) => {
    setManualReading(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleManualInputSubmit = () => {
    // Process manual reading input
    try {
      const systolic = parseInt(manualReading.systolic);
      const diastolic = parseInt(manualReading.diastolic);
      const pulse = parseInt(manualReading.pulse);
      
      if (isNaN(systolic) || isNaN(diastolic) || isNaN(pulse)) {
        toast({
          title: 'Invalid Input',
          description: 'Please enter valid numeric values for all fields.',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate ranges
      if (systolic < 70 || systolic > 250 || diastolic < 40 || diastolic > 180 || pulse < 40 || pulse > 200) {
        toast({
          title: 'Value Out of Range',
          description: 'Please enter values within normal physiological ranges.',
          variant: 'destructive',
        });
        return;
      }
      
      // Determine blood pressure category
      let category = "";
      if (systolic < 120 && diastolic < 80) {
        category = "Normal";
      } else if ((systolic >= 120 && systolic <= 129) && diastolic < 80) {
        category = "Elevated";
      } else if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
        category = "Stage 1 Hypertension";
      } else if (systolic >= 140 || diastolic >= 90) {
        category = "Stage 2 Hypertension";
      } else if (systolic > 180 || diastolic > 120) {
        category = "Hypertensive Crisis";
      }
      
      // Submit the reading
      onReadingReceived({
        deviceId: device?.id || 'manual',
        patientId: patientId,
        systolic,
        diastolic,
        pulse,
        notes: `Manual reading from ${device?.name || 'device'} - ${category}`
      });
      
      toast({
        title: 'Reading Saved',
        description: `BP: ${systolic}/${diastolic} mmHg (${category}), Pulse: ${pulse} bpm`,
      });
      
      // Close the dialog
      setShowManualInputDialog(false);
    } catch (error) {
      console.error('Error processing manual input:', error);
      toast({
        title: 'Input Error',
        description: 'There was an error processing your input. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const saveDevice = () => {
    if (!device || !deviceInfo) return;
    
    // Create device data object
    const deviceData = {
      patientId: patientId,
      name: customDeviceName,
      type: deviceType,
      model: `${deviceInfo.manufacturer} ${deviceInfo.model}`,
      status: 'connected'
    };
    
    // Pass device data to parent component
    onDeviceConnected(deviceData);
    
    setIsDeviceDialogOpen(false);
  };

  if (!isBluetoothAvailable()) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Bluetooth Not Available</AlertTitle>
        <AlertDescription>
          Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex flex-col space-y-2">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              connectDevice(false);
            }}
            disabled={isConnecting}
            className="flex-1"
          >
            <Bluetooth className="h-4 w-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect FDA Device'}
          </Button>
          
          <Button
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              connectDevice(true);
            }}
            disabled={isConnecting}
            className="flex-1"
          >
            <Bluetooth className="h-4 w-4 mr-2" />
            Any Bluetooth Device
          </Button>
        </div>
        
        {device && (
          <div className="flex space-x-2">
            <Button
              onClick={readData}
              disabled={isReading || !device}
              className="flex-1"
            >
              <Activity className="h-4 w-4 mr-2" />
              {isReading ? 'Reading...' : 'Get Reading'}
            </Button>
            
            {deviceType === 'bp' && (
              <Button
                variant="secondary"
                onClick={() => setShowManualInputDialog(true)}
                className="flex-1"
              >
                <Activity className="h-4 w-4 mr-2" />
                Manual Input
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Device Setup Dialog */}
      <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Bluetooth Device Found</DialogTitle>
            <DialogDescription>
              Customize the name for this device. This will help you identify it later.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deviceName" className="text-right">
                Device Name
              </Label>
              <Input
                id="deviceName"
                value={customDeviceName}
                onChange={(e) => setCustomDeviceName(e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Device Type</Label>
              <div className="col-span-3">
                {deviceType === 'bp' ? 'Blood Pressure Monitor' : 'Glucose Meter'}
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Manufacturer</Label>
              <div className="col-span-3">
                {deviceInfo?.manufacturer || 'Unknown'}
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Model</Label>
              <div className="col-span-3">
                {deviceInfo?.model || 'Unknown'}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeviceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDevice}>
              Save Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manual Blood Pressure Input Dialog */}
      <Dialog open={showManualInputDialog} onOpenChange={setShowManualInputDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Blood Pressure Reading</DialogTitle>
            <DialogDescription>
              Enter the blood pressure values from your device.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="systolic" className="text-right">
                Systolic (mmHg)
              </Label>
              <Input
                id="systolic"
                type="number"
                value={manualReading.systolic}
                onChange={(e) => handleManualInputChange('systolic', e.target.value)}
                className="col-span-3"
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
                type="number"
                value={manualReading.diastolic}
                onChange={(e) => handleManualInputChange('diastolic', e.target.value)}
                className="col-span-3"
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
                type="number"
                value={manualReading.pulse}
                onChange={(e) => handleManualInputChange('pulse', e.target.value)}
                className="col-span-3"
                min="40"
                max="200"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualInputDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualInputSubmit}>
              Save Reading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}