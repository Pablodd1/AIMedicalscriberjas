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
  readGlucoseData
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

  const connectDevice = async () => {
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
      
      if (deviceType === 'bp') {
        bluetoothDevice = await connectBloodPressureMonitor();
      } else {
        bluetoothDevice = await connectGlucoseMeter();
      }
      
      if (bluetoothDevice) {
        setDevice(bluetoothDevice);
        
        // Get device info
        const info = await getDeviceInfo(bluetoothDevice);
        setDeviceInfo(info);
        
        // Open dialog to customize device name
        setCustomDeviceName(`${info.manufacturer} ${info.model}`);
        setIsDeviceDialogOpen(true);
        
        toast({
          title: 'Device Connected',
          description: `Connected to ${bluetoothDevice.name || 'medical device'}`,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: 'Failed to connect to the device. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error connecting to device:', error);
      toast({
        title: 'Connection Error',
        description: error.message || 'Failed to connect to the device.',
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
    
    try {
      let readingData = null;
      
      if (deviceType === 'bp') {
        readingData = await readBloodPressureData(device);
        
        if (readingData) {
          toast({
            title: 'Reading Success',
            description: `BP: ${readingData.systolic}/${readingData.diastolic} mmHg, Pulse: ${readingData.pulse} bpm`,
          });
          
          onReadingReceived({
            deviceId: device.id,
            patientId: patientId,
            systolic: readingData.systolic,
            diastolic: readingData.diastolic,
            pulse: readingData.pulse,
            notes: `Automated reading from ${device.name || 'Bluetooth device'}`
          });
        }
      } else {
        readingData = await readGlucoseData(device);
        
        if (readingData) {
          toast({
            title: 'Reading Success',
            description: `Glucose: ${readingData.value} mg/dL (${readingData.type})`,
          });
          
          onReadingReceived({
            deviceId: device.id,
            patientId: patientId,
            value: readingData.value,
            type: readingData.type.toLowerCase(),
            notes: `Automated reading from ${device.name || 'Bluetooth device'}`
          });
        }
      }
      
      if (!readingData) {
        toast({
          title: 'Reading Failed',
          description: 'Failed to get a reading from the device. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reading data:', error);
      toast({
        title: 'Reading Error',
        description: error.message || 'Failed to read data from the device.',
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
      <div className="flex space-x-2">
        <Button
          variant="outline"
          onClick={connectDevice}
          disabled={isConnecting}
          className="flex-1"
        >
          <Bluetooth className="h-4 w-4 mr-2" />
          {isConnecting ? 'Connecting...' : 'Connect FDA Device'}
        </Button>
        
        {device && (
          <Button
            onClick={readData}
            disabled={isReading || !device}
            className="flex-1"
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
            <DialogTitle>New Device Found</DialogTitle>
            <DialogDescription>
              Customize the name for this medical device. This will help you identify it later.
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