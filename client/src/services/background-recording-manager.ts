import { EventEmitter } from 'events';
import { log, logError } from '../logger';

export interface BackgroundRecordingOptions {
  enableBackgroundSync: boolean;
  enableOfflineStorage: boolean;
  enableAutoRecovery: boolean;
  enableBatteryMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  maxOfflineSize: number; // MB
  syncInterval: number; // milliseconds
  recoveryTimeout: number; // milliseconds
  batteryThreshold: number; // percentage
}

export interface BackgroundRecordingState {
  isActive: boolean;
  isBackground: boolean;
  isOffline: boolean;
  batteryLevel: number;
  isCharging: boolean;
  networkStatus: 'online' | 'offline' | 'poor';
  pendingSync: number;
  lastSync: Date | null;
  storageUsed: number;
  recordingStartTime: Date | null;
  totalRecordingTime: number;
  interruptionCount: number;
}

export interface RecordingSegment {
  id: string;
  timestamp: Date;
  duration: number;
  data: Blob;
  metadata: RecordingMetadata;
  syncStatus: 'pending' | 'synced' | 'failed';
  retryCount: number;
}

export interface RecordingMetadata {
  startTime: Date;
  endTime: Date;
  quality: string;
  format: string;
  size: number;
  transcription?: string;
  confidence?: number;
  medicalTerms?: MedicalTerm[];
}

export interface MedicalTerm {
  term: string;
  type: 'condition' | 'medication' | 'procedure' | 'anatomy' | 'symptom' | 'measurement';
  confidence: number;
  start: number;
  end: number;
}

const DEFAULT_OPTIONS: BackgroundRecordingOptions = {
  enableBackgroundSync: true,
  enableOfflineStorage: true,
  enableAutoRecovery: true,
  enableBatteryMonitoring: true,
  enableNetworkMonitoring: true,
  maxOfflineSize: 100, // 100MB
  syncInterval: 30000, // 30 seconds
  recoveryTimeout: 60000, // 60 seconds
  batteryThreshold: 20 // 20%
};

export class BackgroundRecordingManager extends EventEmitter {
  private options: BackgroundRecordingOptions;
  private state: BackgroundRecordingState;
  private segments: RecordingSegment[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private recoveryTimeout: NodeJS.Timeout | null = null;
  private batteryMonitor: number | null = null;
  private isServiceWorkerReady = false;
  private currentRecording: {
    startTime: Date;
    segments: RecordingSegment[];
    totalDuration: number;
  } | null = null;

  constructor(options: Partial<BackgroundRecordingOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    this.state = {
      isActive: false,
      isBackground: false,
      isOffline: false,
      batteryLevel: 100,
      isCharging: true,
      networkStatus: 'online',
      pendingSync: 0,
      lastSync: null,
      storageUsed: 0,
      recordingStartTime: null,
      totalRecordingTime: 0,
      interruptionCount: 0
    };

    this.initializeServiceWorker();
    this.setupEventListeners();
    this.startBatteryMonitoring();
    this.startNetworkMonitoring();
  }

  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw-background-recording.js');
        this.isServiceWorkerReady = true;
        log('Service worker registered for background recording');
        
        // Setup message channel
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          this.handleServiceWorkerMessage(event.data);
        };
        
        registration.active?.postMessage({
          type: 'INIT_BACKGROUND_RECORDING',
          options: this.options
        }, [messageChannel.port2]);
      } catch (error) {
        logError('Service worker registration failed:', error);
        this.isServiceWorkerReady = false;
      }
    }
  }

  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      const isBackground = document.hidden;
      this.setState({ isBackground });
      
      if (isBackground && this.state.isActive) {
        this.enterBackgroundMode();
      } else if (!isBackground && this.state.isActive) {
        this.exitBackgroundMode();
      }
    });

    // Handle before unload (emergency save)
    window.addEventListener('beforeunload', (e) => {
      if (this.state.isActive) {
        this.emergencySave();
        e.preventDefault();
        e.returnValue = 'Recording is in progress. Data will be saved locally.';
      }
    });

    // Handle online/offline
    window.addEventListener('online', () => {
      this.setState({ networkStatus: 'online' });
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      this.setState({ networkStatus: 'offline' });
    });

    // Handle focus/blur for background detection
    window.addEventListener('focus', () => {
      this.setState({ isBackground: false });
      this.syncPendingData();
    });

    window.addEventListener('blur', () => {
      this.setState({ isBackground: true });
      if (this.state.isActive) {
        this.enterBackgroundMode();
      }
    });
  }

  private startBatteryMonitoring(): void {
    if (!this.options.enableBatteryMonitoring || !('getBattery' in navigator)) {
      return;
    }

    const monitorBattery = async () => {
      try {
        // @ts-ignore - Battery API
        const battery = await navigator.getBattery();
        
        const updateBatteryState = () => {
          this.setState({
            batteryLevel: Math.round(battery.level * 100),
            isCharging: battery.charging
          });

          // Check if we need to take action due to low battery
          if (battery.level * 100 < this.options.batteryThreshold && !battery.charging) {
            this.handleLowBattery();
          }
        };

        // Initial state
        updateBatteryState();

        // Monitor battery events
        battery.addEventListener('levelchange', updateBatteryState);
        battery.addEventListener('chargingchange', updateBatteryState);

        this.batteryMonitor = setInterval(updateBatteryState, 60000); // Check every minute
      } catch (error) {
        logError('Battery monitoring failed:', error);
      }
    };

    monitorBattery();
  }

  private startNetworkMonitoring(): void {
    if (!this.options.enableNetworkMonitoring) return;

    const checkNetworkStatus = () => {
      const isOnline = navigator.onLine;
      let networkStatus: 'online' | 'offline' | 'poor' = isOnline ? 'online' : 'offline';

      // Additional network quality check (if available)
      if ('connection' in navigator) {
        // @ts-ignore - Network Information API
        const connection = navigator.connection;
        if (connection && connection.effectiveType === '2g') {
          networkStatus = 'poor';
        }
      }

      this.setState({ networkStatus });
    };

    checkNetworkStatus();
    setInterval(checkNetworkStatus, 10000); // Check every 10 seconds
  }

  private handleLowBattery(): void {
    if (this.state.isActive) {
      log('Low battery detected during recording');
      this.emit('lowBattery', {
        level: this.state.batteryLevel,
        isCharging: this.state.isCharging
      });

      // Notify user and potentially pause non-essential features
      if (this.state.batteryLevel < 10) {
        this.emit('criticalBattery', {
          level: this.state.batteryLevel,
          message: 'Critical battery level. Recording may be interrupted.'
        });
      }
    }
  }

  private enterBackgroundMode(): void {
    log('Entering background recording mode');
    
    this.emit('backgroundMode', { 
      isBackground: true,
      timestamp: new Date()
    });

    // Start offline storage if needed
    if (this.options.enableOfflineStorage) {
      this.startOfflineStorage();
    }

    // Start background sync
    if (this.options.enableBackgroundSync) {
      this.startBackgroundSync();
    }

    // Request wake lock for critical recording
    this.requestWakeLock();
  }

  private exitBackgroundMode(): void {
    log('Exiting background recording mode');
    
    this.emit('backgroundMode', { 
      isBackground: false,
      timestamp: new Date()
    });

    // Sync any pending data
    this.syncPendingData();

    // Stop background sync
    this.stopBackgroundSync();
  }

  private startBackgroundSync(): void {
    if (!this.options.enableBackgroundSync) return;

    this.syncInterval = setInterval(() => {
      this.syncPendingData();
    }, this.options.syncInterval);
  }

  private stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private startOfflineStorage(): void {
    this.setState({ isOffline: true });
    log('Starting offline storage mode');
  }

  private async syncPendingData(): Promise<void> {
    if (this.state.networkStatus !== 'online' || this.state.pendingSync === 0) {
      return;
    }

    try {
      const pendingSegments = this.segments.filter(s => s.syncStatus === 'pending');
      
      for (const segment of pendingSegments) {
        await this.syncSegment(segment);
      }

      this.setState({ 
        lastSync: new Date(),
        pendingSync: this.segments.filter(s => s.syncStatus === 'pending').length
      });

      log(`Synced ${pendingSegments.length} segments`);
    } catch (error) {
      logError('Failed to sync data:', error);
    }
  }

  private async syncSegment(segment: RecordingSegment): Promise<void> {
    try {
      // Simulate API call to sync segment
      const response = await fetch('/api/sync-recording-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: segment.id,
          data: segment.data,
          metadata: segment.metadata
        })
      });

      if (response.ok) {
        segment.syncStatus = 'synced';
        segment.retryCount = 0;
      } else {
        throw new Error(`Sync failed: ${response.statusText}`);
      }
    } catch (error) {
      segment.retryCount++;
      segment.syncStatus = segment.retryCount >= 3 ? 'failed' : 'pending';
      throw error;
    }
  }

  private requestWakeLock(): void {
    if (!('wakeLock' in navigator) || !this.state.isActive) return;

    navigator.wakeLock.request('screen')
      .then(wakeLock => {
        log('Wake lock acquired for background recording');
        
        wakeLock.addEventListener('release', () => {
          log('Wake lock released');
          this.emit('wakeLockReleased');
        });
      })
      .catch(error => {
        logError('Failed to acquire wake lock:', error);
        this.emit('wakeLockFailed', { error });
      });
  }

  private emergencySave(): void {
    if (!this.options.enableOfflineStorage || !this.state.isActive) return;

    try {
      const emergencyData = {
        timestamp: new Date().toISOString(),
        state: this.state,
        segments: this.segments,
        currentRecording: this.currentRecording
      };

      localStorage.setItem('emergency-recording-data', JSON.stringify(emergencyData));
      
      log('Emergency data saved locally');
      this.emit('emergencySave', { timestamp: new Date() });
    } catch (error) {
      logError('Emergency save failed:', error);
    }
  }

  private handleServiceWorkerMessage(message: any): void {
    switch (message.type) {
      case 'BACKGROUND_SYNC_COMPLETE':
        this.setState({ pendingSync: 0, lastSync: new Date() });
        break;
      
      case 'DEVICE_SLEEP_DETECTED':
        this.handleInterruption('device-sleep');
        break;
      
      case 'NETWORK_CHANGE':
        this.setState({ networkStatus: message.networkStatus });
        if (message.networkStatus === 'online') {
          this.syncPendingData();
        }
        break;
    }
  }

  private handleInterruption(reason: string): void {
    this.setState({ 
      interruptionCount: this.state.interruptionCount + 1 
    });

    this.emit('interruption', {
      reason,
      timestamp: new Date(),
      state: this.state
    });

    if (this.options.enableAutoRecovery) {
      this.startRecoveryTimer();
    }
  }

  private startRecoveryTimer(): void {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }

    this.recoveryTimeout = setTimeout(() => {
      this.attemptRecovery();
    }, this.options.recoveryTimeout);
  }

  private async attemptRecovery(): Promise<void> {
    try {
      // Check if we can recover
      if (this.state.interruptionCount > 5) {
        throw new Error('Too many interruptions');
      }

      // Attempt to re-establish connection and sync
      await this.syncPendingData();

      this.emit('recovery', {
        success: true,
        timestamp: new Date(),
        state: this.state
      });
    } catch (error) {
      this.emit('recovery', {
        success: false,
        error,
        timestamp: new Date()
      });
    }
  }

  private setState(updates: Partial<BackgroundRecordingState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    if (JSON.stringify(oldState) !== JSON.stringify(this.state)) {
      this.emit('stateChange', { 
        oldState, 
        newState: this.state 
      });
    }
  }

  // Public API
  public startRecording(): void {
    if (this.state.isActive) return;

    this.setState({
      isActive: true,
      recordingStartTime: new Date(),
      totalRecordingTime: 0,
      interruptionCount: 0
    });

    this.currentRecording = {
      startTime: new Date(),
      segments: [],
      totalDuration: 0
    };

    this.startBackgroundSync();
    this.requestWakeLock();

    this.emit('recordingStart', { timestamp: new Date() });
  }

  public stopRecording(): void {
    if (!this.state.isActive) return;

    this.setState({ isActive: false });

    this.stopBackgroundSync();
    this.syncPendingData();

    if (this.currentRecording) {
      this.currentRecording.totalDuration = 
        Date.now() - this.currentRecording.startTime.getTime();
    }

    this.emit('recordingStop', {
      timestamp: new Date(),
      totalDuration: this.state.totalRecordingTime,
      segments: this.segments.length
    });
  }

  public addSegment(data: Blob, metadata: RecordingMetadata): void {
    const segment: RecordingSegment = {
      id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      duration: metadata.endTime.getTime() - metadata.startTime.getTime(),
      data,
      metadata,
      syncStatus: this.state.networkStatus === 'online' ? 'pending' : 'pending',
      retryCount: 0
    };

    this.segments.push(segment);
    
    this.setState({
      totalRecordingTime: this.state.totalRecordingTime + segment.duration,
      pendingSync: this.segments.filter(s => s.syncStatus === 'pending').length
    });

    if (this.currentRecording) {
      this.currentRecording.segments.push(segment);
    }

    // Store offline if needed
    if (this.options.enableOfflineStorage && this.state.isOffline) {
      this.storeOfflineSegment(segment);
    }

    this.emit('segmentAdded', { segment });
  }

  private storeOfflineSegment(segment: RecordingSegment): void {
    try {
      // Store in IndexedDB or localStorage
      const offlineData = {
        id: segment.id,
        timestamp: segment.timestamp.toISOString(),
        data: segment.data,
        metadata: segment.metadata
      };

      // Use IndexedDB for large data
      if ('indexedDB' in window) {
        this.saveToIndexedDB(offlineData);
      } else {
        // Fallback to localStorage for smaller segments
        localStorage.setItem(`segment_${segment.id}`, JSON.stringify(offlineData));
      }
    } catch (error) {
      logError('Failed to store offline segment:', error);
    }
  }

  private async saveToIndexedDB(data: any): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['recording-segments'], 'readwrite');
      const store = transaction.objectStore('recording-segments');
      
      await store.add(data);
    } catch (error) {
      logError('IndexedDB save failed:', error);
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
          db.createObjectStore('recording-segments', { keyPath: 'id' });
        }
      };
    });
  }

  public getState(): BackgroundRecordingState {
    return { ...this.state };
  }

  public getSegments(): RecordingSegment[] {
    return [...this.segments];
  }

  public getPendingSyncCount(): number {
    return this.segments.filter(s => s.syncStatus === 'pending').length;
  }

  public async forceSync(): Promise<void> {
    await this.syncPendingData();
  }

  public destroy(): void {
    this.stopBackgroundSync();
    
    if (this.batteryMonitor) {
      clearInterval(this.batteryMonitor);
    }
    
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }
    
    this.removeAllListeners();
  }
}