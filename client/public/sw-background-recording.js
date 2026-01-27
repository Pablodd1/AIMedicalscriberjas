// Service Worker for Background Recording Protection
// This service worker handles device sleep, background recording, and data persistence

const CACHE_NAME = 'medical-recording-v1';
const OFFLINE_STORAGE_NAME = 'medical-recording-offline';

interface BackgroundRecordingState {
  isRecording: boolean;
  startTime: number;
  lastActivity: number;
  segments: RecordingSegment[];
  deviceStatus: DeviceStatus;
}

interface RecordingSegment {
  id: string;
  timestamp: number;
  duration: number;
  data: ArrayBuffer;
  metadata: RecordingMetadata;
}

interface RecordingMetadata {
  startTime: number;
  endTime: number;
  quality: string;
  format: string;
  size: number;
}

interface DeviceStatus {
  batteryLevel: number;
  isCharging: boolean;
  isOnline: boolean;
  isAwake: boolean;
}

class BackgroundRecordingService {
  private state: BackgroundRecordingState = {
    isRecording: false,
    startTime: 0,
    lastActivity: Date.now(),
    segments: [],
    deviceStatus: {
      batteryLevel: 100,
      isCharging: true,
      isOnline: true,
      isAwake: true
    }
  };

  private heartbeatInterval: number | null = null;
  private syncInterval: number | null = null;
  private deviceMonitorInterval: number | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private messagePort: MessagePort | null = null;
  private emergencyData: any = null;

  constructor() {
    this.setupEventListeners();
    this.startDeviceMonitoring();
  }

  private setupEventListeners(): void {
    // Handle messages from the main thread
    self.addEventListener('message', (event) => {
      this.handleMessage(event.data, event.ports[0]);
    });

    // Handle visibility changes
    self.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Handle online/offline
    self.addEventListener('online', () => {
      this.state.deviceStatus.isOnline = true;
      this.syncPendingData();
    });

    self.addEventListener('offline', () => {
      this.state.deviceStatus.isOnline = false;
    });

    // Handle page unload (emergency save)
    self.addEventListener('beforeunload', () => {
      this.emergencySave();
    });

    // Handle battery status changes (if available)
    if ('getBattery' in navigator) {
      this.monitorBattery();
    }

    // Handle network changes
    if ('connection' in navigator) {
      this.monitorNetworkConnection();
    }
  }

  private handleMessage(message: any, port: MessagePort): void {
    this.messagePort = port;

    switch (message.type) {
      case 'INIT_BACKGROUND_RECORDING':
        this.initializeBackgroundRecording(message.options);
        break;

      case 'START_RECORDING':
        this.startBackgroundRecording();
        break;

      case 'STOP_RECORDING':
        this.stopBackgroundRecording();
        break;

      case 'ADD_SEGMENT':
        this.addSegment(message.segment);
        break;

      case 'GET_STATUS':
        this.sendStatus();
        break;

      case 'SYNC_DATA':
        this.syncPendingData();
        break;

      case 'REQUEST_WAKE_LOCK':
        this.requestWakeLock();
        break;

      case 'RELEASE_WAKE_LOCK':
        this.releaseWakeLock();
        break;

      case 'EMERGENCY_SAVE':
        this.emergencySave();
        break;
    }
  }

  private initializeBackgroundRecording(options: any): void {
    // Configure background recording options
    this.sendMessage({
      type: 'BACKGROUND_RECORDING_INITIALIZED',
      state: this.state
    });
  }

  private startBackgroundRecording(): void {
    if (this.state.isRecording) return;

    this.state.isRecording = true;
    this.state.startTime = Date.now();
    this.state.lastActivity = Date.now();

    // Request wake lock to prevent device sleep
    this.requestWakeLock();

    // Start heartbeat to detect if device goes to sleep
    this.startHeartbeat();

    // Start background sync
    this.startBackgroundSync();

    // Start device monitoring
    this.startDeviceMonitoring();

    this.sendMessage({
      type: 'BACKGROUND_RECORDING_STARTED',
      timestamp: Date.now(),
      state: this.state
    });

    // Notify main thread
    this.notifyMainThread('recordingStarted', {
      startTime: this.state.startTime,
      deviceStatus: this.state.deviceStatus
    });
  }

  private stopBackgroundRecording(): void {
    if (!this.state.isRecording) return;

    this.state.isRecording = false;

    // Stop heartbeat
    this.stopHeartbeat();

    // Stop background sync
    this.stopBackgroundSync();

    // Stop device monitoring
    this.stopDeviceMonitoring();

    // Release wake lock
    this.releaseWakeLock();

    // Sync any remaining data
    this.syncPendingData();

    this.sendMessage({
      type: 'BACKGROUND_RECORDING_STOPPED',
      timestamp: Date.now(),
      totalDuration: Date.now() - this.state.startTime,
      segments: this.state.segments.length
    });

    // Notify main thread
    this.notifyMainThread('recordingStopped', {
      stopTime: Date.now(),
      totalDuration: Date.now() - this.state.startTime,
      segments: this.state.segments.length
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = self.setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - this.state.lastActivity;

      // Check if device might have gone to sleep
      if (timeSinceLastActivity > 30000) { // 30 seconds
        this.handleDeviceSleep();
      }

      // Update last activity
      this.state.lastActivity = now;

      // Send heartbeat
      this.sendMessage({
        type: 'HEARTBEAT',
        timestamp: now,
        timeSinceLastActivity
      });

      // Check if we need to take action
      if (this.state.isRecording) {
        this.checkDeviceHealth();
      }
    }, 5000); // Every 5 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startBackgroundSync(): void {
    this.syncInterval = self.setInterval(() => {
      this.syncPendingData();
    }, 30000); // Every 30 seconds
  }

  private stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private startDeviceMonitoring(): void {
    this.deviceMonitorInterval = self.setInterval(() => {
      this.checkDeviceHealth();
      this.updateDeviceStatus();
    }, 10000); // Every 10 seconds
  }

  private stopDeviceMonitoring(): void {
    if (this.deviceMonitorInterval) {
      clearInterval(this.deviceMonitorInterval);
      this.deviceMonitorInterval = null;
    }
  }

  private handleDeviceSleep(): void {
    // Device likely went to sleep
    this.state.deviceStatus.isAwake = false;

    this.sendMessage({
      type: 'DEVICE_SLEEP_DETECTED',
      timestamp: Date.now(),
      lastActivity: this.state.lastActivity
    });

    // Attempt to recover
    this.attemptRecovery();
  }

  private handleVisibilityChange(): void {
    const isVisible = !self.document.hidden;
    this.state.deviceStatus.isAwake = isVisible;

    if (!isVisible && this.state.isRecording) {
      // Page is hidden, increase monitoring frequency
      this.increaseMonitoringFrequency();
    } else if (isVisible && this.state.isRecording) {
      // Page is visible again
      this.restoreMonitoringFrequency();
    }
  }

  private increaseMonitoringFrequency(): void {
    // Increase heartbeat frequency when in background
    this.stopHeartbeat();
    this.heartbeatInterval = self.setInterval(() => {
      this.checkDeviceHealth();
    }, 2000); // Every 2 seconds
  }

  private restoreMonitoringFrequency(): void {
    // Restore normal monitoring frequency
    this.stopHeartbeat();
    this.startHeartbeat();
  }

  private async requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return;

    try {
      // @ts-ignore - Wake Lock API
      this.wakeLock = await navigator.wakeLock.request('screen');

      this.wakeLock.addEventListener('release', () => {
        this.sendMessage({
          type: 'WAKE_LOCK_RELEASED',
          timestamp: Date.now()
        });
      });

      this.sendMessage({
        type: 'WAKE_LOCK_ACQUIRED',
        timestamp: Date.now()
      });
    } catch (error) {
      this.sendMessage({
        type: 'WAKE_LOCK_FAILED',
        timestamp: Date.now(),
        error: error.message
      });
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  private async monitorBattery(): Promise<void> {
    try {
      // @ts-ignore - Battery API
      const battery = await navigator.getBattery();

      const updateBatteryStatus = () => {
        this.state.deviceStatus.batteryLevel = Math.round(battery.level * 100);
        this.state.deviceStatus.isCharging = battery.charging;

        // Check for low battery
        if (this.state.deviceStatus.batteryLevel < 20 && !battery.charging) {
          this.handleLowBattery();
        }

        this.sendMessage({
          type: 'BATTERY_STATUS_UPDATE',
          batteryLevel: this.state.deviceStatus.batteryLevel,
          isCharging: this.state.deviceStatus.isCharging
        });
      };

      // Initial update
      updateBatteryStatus();

      // Monitor battery events
      battery.addEventListener('levelchange', updateBatteryStatus);
      battery.addEventListener('chargingchange', updateBatteryStatus);
    } catch (error) {
      console.error('Battery monitoring failed:', error);
    }
  }

  private monitorNetworkConnection(): void {
    if (!('connection' in navigator)) return;

    // @ts-ignore - Network Information API
    const connection = navigator.connection;

    const updateConnectionStatus = () => {
      this.state.deviceStatus.isOnline = navigator.onLine;
      
      this.sendMessage({
        type: 'NETWORK_STATUS_UPDATE',
        isOnline: this.state.deviceStatus.isOnline,
        connectionType: connection.effectiveType
      });

      // Sync data if back online
      if (this.state.deviceStatus.isOnline) {
        this.syncPendingData();
      }
    };

    connection.addEventListener('change', updateConnectionStatus);
    updateConnectionStatus();
  }

  private handleLowBattery(): void {
    this.sendMessage({
      type: 'LOW_BATTERY_DETECTED',
      batteryLevel: this.state.deviceStatus.batteryLevel,
      isCharging: this.state.deviceStatus.isCharging
    });

    // If battery is critical, save data
    if (this.state.deviceStatus.batteryLevel < 10) {
      this.emergencySave();
    }
  }

  private checkDeviceHealth(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.state.lastActivity;

    // Check for potential issues
    const issues = [];

    if (timeSinceLastActivity > 60000) { // 1 minute
      issues.push('device-inactive');
    }

    if (this.state.deviceStatus.batteryLevel < 15) {
      issues.push('low-battery');
    }

    if (!this.state.deviceStatus.isOnline) {
      issues.push('offline');
    }

    if (!this.state.deviceStatus.isAwake) {
      issues.push('device-sleeping');
    }

    if (issues.length > 0) {
      this.sendMessage({
        type: 'DEVICE_HEALTH_WARNING',
        issues,
        timestamp: now
      });
    }
  }

  private updateDeviceStatus(): void {
    this.sendMessage({
      type: 'DEVICE_STATUS_UPDATE',
      deviceStatus: this.state.deviceStatus,
      recordingState: {
        isActive: this.state.isRecording,
        startTime: this.state.startTime,
        lastActivity: this.state.lastActivity,
        segmentCount: this.state.segments.length
      }
    });
  }

  private addSegment(segment: RecordingSegment): void {
    this.state.segments.push(segment);
    this.state.lastActivity = Date.now();

    // Store offline if needed
    this.storeSegmentOffline(segment);

    this.sendMessage({
      type: 'SEGMENT_ADDED',
      segment,
      totalSegments: this.state.segments.length
    });
  }

  private storeSegmentOffline(segment: RecordingSegment): void {
    try {
      // Store in IndexedDB for offline access
      this.saveToIndexedDB(segment);
    } catch (error) {
      console.error('Failed to store segment offline:', error);
    }
  }

  private async saveToIndexedDB(segment: RecordingSegment): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['recording-segments'], 'readwrite');
      const store = transaction.objectStore('recording-segments');
      
      await store.add({
        ...segment,
        timestamp: segment.timestamp,
        data: segment.data // ArrayBuffer
      });

      db.close();
    } catch (error) {
      console.error('IndexedDB save failed:', error);
    }
  }

  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('medical-recording-db', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('recording-segments')) {
          const store = db.createObjectStore('recording-segments', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('syncStatus', 'syncStatus');
        }
      };
    });
  }

  private async syncPendingData(): Promise<void> {
    if (!this.state.deviceStatus.isOnline) return;

    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['recording-segments'], 'readonly');
      const store = transaction.objectStore('recording-segments');
      const index = store.index('syncStatus');
      
      const pendingSegments = await index.getAll('pending');
      
      for (const segment of pendingSegments) {
        await this.syncSegment(segment);
      }

      db.close();

      this.sendMessage({
        type: 'SYNC_COMPLETE',
        syncedSegments: pendingSegments.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  private async syncSegment(segment: RecordingSegment): Promise<void> {
    try {
      const response = await fetch('/api/sync-recording-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: segment.id,
          data: Array.from(new Uint8Array(segment.data)), // Convert ArrayBuffer to array
          metadata: segment.metadata
        })
      });

      if (response.ok) {
        // Update segment status in IndexedDB
        const db = await this.openIndexedDB();
        const transaction = db.transaction(['recording-segments'], 'readwrite');
        const store = transaction.objectStore('recording-segments');
        
        segment.syncStatus = 'synced';
        await store.put(segment);
        db.close();
      }
    } catch (error) {
      console.error('Segment sync failed:', error);
      // Mark as failed after 3 retries
      if (segment.retryCount >= 3) {
        segment.syncStatus = 'failed';
      } else {
        segment.retryCount++;
        segment.syncStatus = 'pending';
      }
    }
  }

  private attemptRecovery(): void {
    // Attempt to recover from device sleep or interruption
    this.sendMessage({
      type: 'RECOVERY_ATTEMPT',
      timestamp: Date.now(),
      state: this.state
    });

    // Request wake lock again
    this.requestWakeLock();

    // Check if we need to sync data
    this.syncPendingData();
  }

  private emergencySave(): void {
    // Emergency save when device is about to shut down or sleep
    this.emergencyData = {
      timestamp: Date.now(),
      state: this.state,
      segments: this.state.segments.slice(-10), // Last 10 segments
      deviceStatus: this.state.deviceStatus
    };

    // Store in localStorage as backup
    try {
      localStorage.setItem('emergency-recording-data', JSON.stringify(this.emergencyData));
    } catch (error) {
      console.error('Emergency save failed:', error);
    }

    this.sendMessage({
      type: 'EMERGENCY_SAVE_COMPLETE',
      timestamp: Date.now(),
      segmentsSaved: this.emergencyData.segments.length
    });
  }

  private sendMessage(message: any): void {
    if (this.messagePort) {
      this.messagePort.postMessage(message);
    }
  }

  private sendStatus(): void {
    this.sendMessage({
      type: 'STATUS_RESPONSE',
      state: this.state,
      deviceStatus: this.state.deviceStatus,
      emergencyData: this.emergencyData
    });
  }

  private notifyMainThread(event: string, data: any): void {
    // Send message to all clients (main thread)
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'BACKGROUND_EVENT',
          event,
          data,
          timestamp: Date.now()
        });
      });
    });
  }
}

// Initialize the service worker
const backgroundService = new BackgroundRecordingService();

// Export for use in main thread
export default backgroundService;