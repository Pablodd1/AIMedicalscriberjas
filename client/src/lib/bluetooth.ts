/**
 * Bluetooth Low Energy (BLE) utility for connecting to and reading from 
 * FDA-cleared medical devices like blood pressure monitors and glucose meters.
 */

// Define service UUIDs for common FDA-cleared devices
// Note: These are example UUIDs - actual device UUIDs should be used in production
export const BLE_SERVICES = {
  // Blood pressure service
  BLOOD_PRESSURE: {
    SERVICE: '00002a35-0000-1000-8000-00805f9b34fb',
    MEASUREMENT: '00002a36-0000-1000-8000-00805f9b34fb',
  },
  // Glucose service
  GLUCOSE: {
    SERVICE: '00001808-0000-1000-8000-00805f9b34fb',
    MEASUREMENT: '00002a18-0000-1000-8000-00805f9b34fb',
  },
  // Device Information Service - common to most BLE devices
  DEVICE_INFO: {
    SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
    MANUFACTURER: '00002a29-0000-1000-8000-00805f9b34fb',
    MODEL: '00002a24-0000-1000-8000-00805f9b34fb',
  }
};

/**
 * Check if Web Bluetooth API is available in the browser
 */
export const isBluetoothAvailable = (): boolean => {
  return navigator?.bluetooth !== undefined;
};

/**
 * Request a Bluetooth device with specified services
 * @param serviceUUIDs Array of service UUIDs to request
 * @returns Connected Bluetooth device or null if connection failed
 */
export const requestDevice = async (
  serviceUUIDs: string[]
): Promise<BluetoothDevice | null> => {
  if (!isBluetoothAvailable()) {
    throw new Error("Bluetooth not supported by this browser");
  }
  
  try {
    // Request a device matching the filter criteria
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: serviceUUIDs }
      ],
      optionalServices: [BLE_SERVICES.DEVICE_INFO.SERVICE]
    });
    
    return device;
  } catch (error) {
    console.error("Bluetooth device request failed:", error);
    return null;
  }
};

/**
 * Connect to a blood pressure monitor
 * @returns BluetoothDevice or null if connection failed
 */
export const connectBloodPressureMonitor = async (): Promise<BluetoothDevice | null> => {
  return requestDevice([BLE_SERVICES.BLOOD_PRESSURE.SERVICE]);
};

/**
 * Connect to a glucose meter
 * @returns BluetoothDevice or null if connection failed
 */
export const connectGlucoseMeter = async (): Promise<BluetoothDevice | null> => {
  return requestDevice([BLE_SERVICES.GLUCOSE.SERVICE]);
};

/**
 * Get device information such as manufacturer and model
 * @param device Connected Bluetooth device
 * @returns Object containing manufacturer and model information
 */
export const getDeviceInfo = async (
  device: BluetoothDevice
): Promise<{ manufacturer: string; model: string }> => {
  try {
    const server = await device.gatt?.connect();
    if (!server) throw new Error("Failed to connect to GATT server");
    
    const service = await server.getPrimaryService(BLE_SERVICES.DEVICE_INFO.SERVICE);
    
    // Get manufacturer name
    const manufacturerChar = await service.getCharacteristic(
      BLE_SERVICES.DEVICE_INFO.MANUFACTURER
    );
    const manufacturerValue = await manufacturerChar.readValue();
    const manufacturer = new TextDecoder().decode(manufacturerValue);
    
    // Get model number
    const modelChar = await service.getCharacteristic(
      BLE_SERVICES.DEVICE_INFO.MODEL
    );
    const modelValue = await modelChar.readValue();
    const model = new TextDecoder().decode(modelValue);
    
    return { manufacturer, model };
  } catch (error) {
    console.error("Error getting device info:", error);
    return { manufacturer: "Unknown", model: "Unknown" };
  }
};

/**
 * Parse blood pressure reading from bluetooth value
 * @param value DataView containing blood pressure data
 * @returns Object with systolic, diastolic, and pulse values
 */
export const parseBloodPressureReading = (
  value: DataView
): { systolic: number; diastolic: number; pulse: number } => {
  // This is a simplified parser - actual implementation would depend on device specifications
  // Blood pressure data format from IEEE 11073-10407
  const flags = value.getUint8(0);
  
  // IEEE-11073 32-bit float format - using simplified conversion here
  const systolic = value.getUint16(1, true) / 10;  // Convert from kPa to mmHg and divide by 10
  const diastolic = value.getUint16(3, true) / 10;
  const pulse = value.getUint16(5, true);
  
  return {
    systolic: Math.round(systolic),
    diastolic: Math.round(diastolic),
    pulse
  };
};

/**
 * Parse glucose reading from bluetooth value
 * @param value DataView containing glucose data
 * @returns Object with glucose value and type
 */
export const parseGlucoseReading = (
  value: DataView
): { value: number; type: string } => {
  // This is a simplified parser - actual implementation would depend on device specifications
  // Glucose data format from IEEE 11073-10417
  const flags = value.getUint8(0);
  const sequence = value.getUint16(1, true);
  
  // Base time
  const year = value.getUint16(3, true);
  const month = value.getUint8(5);
  const day = value.getUint8(6);
  const hours = value.getUint8(7);
  const minutes = value.getUint8(8);
  const seconds = value.getUint8(9);
  
  // Glucose concentration
  const glucoseConcentration = value.getUint16(10, true);
  const multiplier = 1; // Would be determined by unit used by device
  
  // Type of reading (before/after meal, etc.)
  const typeFlag = (flags & 0x0F);
  const types = [
    "Reserved", 
    "Fasting", 
    "Random", 
    "Pre-meal", 
    "Post-meal", 
    "Exercise", 
    "Bedtime",
    "Other"
  ];
  
  return {
    value: Math.round(glucoseConcentration * multiplier),
    type: types[typeFlag] || "Unknown"
  };
};

/**
 * Read blood pressure data from a connected blood pressure monitor
 * @param device Connected blood pressure monitor
 * @returns Object containing blood pressure reading or null if reading failed
 */
export const readBloodPressureData = async (
  device: BluetoothDevice
): Promise<{ systolic: number; diastolic: number; pulse: number } | null> => {
  try {
    const server = await device.gatt?.connect();
    if (!server) throw new Error("Failed to connect to GATT server");
    
    const service = await server.getPrimaryService(BLE_SERVICES.BLOOD_PRESSURE.SERVICE);
    const characteristic = await service.getCharacteristic(
      BLE_SERVICES.BLOOD_PRESSURE.MEASUREMENT
    );
    
    // Set up notifications for blood pressure readings
    await characteristic.startNotifications();
    
    return new Promise((resolve, reject) => {
      // Set up timeout for reading (30 seconds)
      const timeout = setTimeout(() => {
        characteristic.stopNotifications();
        reject(new Error("Blood pressure reading timeout"));
      }, 30000);
      
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        clearTimeout(timeout);
        
        // @ts-ignore - target event property exists but TypeScript doesn't know about it
        const value = event?.target?.value as DataView;
        if (value) {
          const reading = parseBloodPressureReading(value);
          characteristic.stopNotifications();
          resolve(reading);
        } else {
          characteristic.stopNotifications();
          reject(new Error("Invalid blood pressure data received"));
        }
      });
    });
  } catch (error) {
    console.error("Error reading blood pressure data:", error);
    return null;
  }
};

/**
 * Read glucose data from a connected glucose meter
 * @param device Connected glucose meter
 * @returns Object containing glucose reading or null if reading failed
 */
export const readGlucoseData = async (
  device: BluetoothDevice
): Promise<{ value: number; type: string } | null> => {
  try {
    const server = await device.gatt?.connect();
    if (!server) throw new Error("Failed to connect to GATT server");
    
    const service = await server.getPrimaryService(BLE_SERVICES.GLUCOSE.SERVICE);
    const characteristic = await service.getCharacteristic(
      BLE_SERVICES.GLUCOSE.MEASUREMENT
    );
    
    // Set up notifications for glucose readings
    await characteristic.startNotifications();
    
    return new Promise((resolve, reject) => {
      // Set up timeout for reading (30 seconds)
      const timeout = setTimeout(() => {
        characteristic.stopNotifications();
        reject(new Error("Glucose reading timeout"));
      }, 30000);
      
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        clearTimeout(timeout);
        
        // @ts-ignore - target event property exists but TypeScript doesn't know about it
        const value = event?.target?.value as DataView;
        if (value) {
          const reading = parseGlucoseReading(value);
          characteristic.stopNotifications();
          resolve(reading);
        } else {
          characteristic.stopNotifications();
          reject(new Error("Invalid glucose data received"));
        }
      });
    });
  } catch (error) {
    console.error("Error reading glucose data:", error);
    return null;
  }
};

/**
 * Class to manage Bluetooth device connections and automate data collection
 */
export class BluetoothDeviceManager {
  private devices: Map<string, BluetoothDevice> = new Map();
  
  /**
   * Add a device to the manager
   * @param id Unique identifier for the device (e.g., device ID from database)
   * @param device Bluetooth device object
   */
  addDevice(id: string, device: BluetoothDevice): void {
    this.devices.set(id, device);
    
    // Set up disconnection listener
    device.addEventListener('gattserverdisconnected', () => {
      console.log(`Device ${id} disconnected`);
    });
  }
  
  /**
   * Get a device by ID
   * @param id Device ID
   * @returns Bluetooth device or undefined if not found
   */
  getDevice(id: string): BluetoothDevice | undefined {
    return this.devices.get(id);
  }
  
  /**
   * Remove a device from the manager
   * @param id Device ID
   */
  removeDevice(id: string): void {
    this.devices.delete(id);
  }
  
  /**
   * Get all managed devices
   * @returns Map of device IDs to Bluetooth devices
   */
  getAllDevices(): Map<string, BluetoothDevice> {
    return this.devices;
  }
}

// Create a singleton instance of the device manager
export const deviceManager = new BluetoothDeviceManager();