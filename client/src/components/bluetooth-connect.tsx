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

    setIsConnecting(true);
    
    try {
      let bluetoothDevice: BluetoothDevice | null = null;
      
      if (allowAllDevices) {
        // Allow any Bluetooth device for testing (AirPods, headphones, etc.)
        toast({
          title: 'Bluetooth Pairing',
          description: 'Please select any Bluetooth device from the list.'
        });
        bluetoothDevice = await requestDevice([], true);
      } else {
        // Connect to FDA-cleared medical devices
        if (deviceType === 'bp') {
          toast({
            title: 'Bluetooth Pairing',
            description: 'Looking for blood pressure monitors. Ensure your device is in pairing mode.',
          });
          bluetoothDevice = await connectBloodPressureMonitor();
        } else {
          toast({
            title: 'Bluetooth Pairing',
            description: 'Looking for glucose meters. Ensure your device is in pairing mode.',
          });
          bluetoothDevice = await connectGlucoseMeter();
        }
      }
      
      if (bluetoothDevice) {
        setDevice(bluetoothDevice);
        
        // Try to get device info - this might fail for non-medical devices
        try {
          console.log("Getting device info for:", bluetoothDevice.name);
          const info = await getDeviceInfo(bluetoothDevice);
          console.log("Device info retrieved:", info);
          setDeviceInfo(info);
        } catch (infoError) {
          console.warn('Could not get detailed device info:', infoError);
          // For non-medical devices, use basic info with the device name
          setDeviceInfo({ 
            manufacturer: bluetoothDevice.name?.split(' ')[0] || "Unknown", 
            model: bluetoothDevice.name || "Generic Bluetooth Device" 
          });
        }
        
        // Open dialog to customize device name
        const displayName = bluetoothDevice.name || 'Bluetooth Device';
        setCustomDeviceName(displayName);
        setIsDeviceDialogOpen(true);
        
        toast({
          title: 'Device Connected',
          description: `Successfully connected to ${displayName}`,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: 'Failed to connect to the device. Please make sure your device is powered on and in pairing mode.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error connecting to device:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to connect to the device.';
      
      if (error.message?.includes('User cancelled')) {
        errorMessage = 'Device selection was cancelled.';
      } else if (error.message?.includes('No Bluetooth device')) {
        errorMessage = 'No compatible Bluetooth devices found. Make sure your device is powered on and in pairing mode.';
      } else if (error.message?.includes('GATT')) {
        errorMessage = 'Could not establish a secure connection with the device. Please try again.';
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
        
        readingData = await readBloodPressureData(device);
        
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
        toast({
          title: 'Reading Failed',
          description: 'Failed to get a reading from the device. Make sure the device is properly connected and activated.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reading data:', error);
      
      // Provide more helpful error messages based on device type
      let errorMessage = 'Failed to read data from the device.';
      
      if (deviceType === 'bp') {
        errorMessage = 'Failed to read blood pressure. Make sure the cuff is properly positioned and the device is activated.';
      } else {
        errorMessage = 'Failed to read glucose level. Make sure the test strip is properly inserted and has a blood sample.';
      }
      
      if (error.message?.includes('timeout')) {
        errorMessage = 'The reading timed out. Please ensure the device is properly activated and try again.';
      } else if (error.message?.includes('disconnected')) {
        errorMessage = 'The device disconnected during reading. Please reconnect and try again.';
      }
      
      toast({
        title: 'Reading Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsReading(false);
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
          <Button
            onClick={readData}
            disabled={isReading || !device}
            className="w-full"
          >
            <Activity className="h-4 w-4 mr-2" />
            {isReading ? 'Reading...' : 'Get Reading'}
          </Button>
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
    </div>
  );
}