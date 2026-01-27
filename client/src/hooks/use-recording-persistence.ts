import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface RecordingPersistenceState {
  isRecordingActive: boolean;
  isDeviceAwake: boolean;
  isPowerSaveMode: boolean;
  recordingInterrupted: boolean;
  autoRecoveryEnabled: boolean;
  wakeLockSupported: boolean;
  wakeLockActive: boolean;
  lastActivity: Date;
  interruptionCount: number;
}

export interface PersistenceConfig {
  enableWakeLock: boolean;
  enableAutoRecovery: boolean;
  enablePowerSaveDetection: boolean;
  enableBackgroundSync: boolean;
  enableOfflineStorage: boolean;
  recoveryTimeout: number; // milliseconds
  activityThreshold: number; // milliseconds
  maxInterruptions: number;
}

const DEFAULT_CONFIG: PersistenceConfig = {
  enableWakeLock: true,
  enableAutoRecovery: true,
  enablePowerSaveDetection: true,
  enableBackgroundSync: true,
  enableOfflineStorage: true,
  recoveryTimeout: 30000, // 30 seconds
  activityThreshold: 5000, // 5 seconds
  maxInterruptions: 3
};

export function useRecordingPersistence(
  isRecording: boolean,
  config: Partial<PersistenceConfig> = {}
) {
  const { toast } = useToast();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<RecordingPersistenceState>({
    isRecordingActive: false,
    isDeviceAwake: true,
    isPowerSaveMode: false,
    recordingInterrupted: false,
    autoRecoveryEnabled: mergedConfig.enableAutoRecovery,
    wakeLockSupported: false,
    wakeLockActive: false,
    lastActivity: new Date(),
    interruptionCount: 0
  });

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineDataRef = useRef<Blob[]>([]);
  const lastStateRef = useRef<RecordingPersistenceState>(state);

  // Check wake lock support
  useEffect(() => {
    const isSupported = 'wakeLock' in navigator;
    setState(prev => ({ ...prev, wakeLockSupported: isSupported }));
    
    if (!isSupported && mergedConfig.enableWakeLock) {
      toast({
        title: 'Wake Lock Not Supported',
        description: 'Your device does not support wake lock. Consider using background recording mode.',
        variant: 'destructive'
      });
    }
  }, [mergedConfig.enableWakeLock, toast]);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    if (!mergedConfig.enableWakeLock || !state.wakeLockSupported || state.wakeLockActive) {
      return;
    }

    try {
      // @ts-ignore - Wake Lock API
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      
      setState(prev => ({ ...prev, wakeLockActive: true }));
      
      wakeLockRef.current.addEventListener('release', () => {
        setState(prev => ({ ...prev, wakeLockActive: false }));
        handleInterruption('wake-lock-released');
      });

      toast({
        title: 'Screen Lock Active',
        description: 'Screen will stay awake during recording.'
      });
    } catch (error) {
      console.error('Wake lock request failed:', error);
      toast({
        title: 'Screen Lock Failed',
        description: 'Could not prevent screen sleep. Recording may be interrupted.',
        variant: 'destructive'
      });
    }
  }, [mergedConfig.enableWakeLock, state.wakeLockSupported, state.wakeLockActive, toast]);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setState(prev => ({ ...prev, wakeLockActive: false }));
      } catch (error) {
        console.error('Wake lock release failed:', error);
      }
    }
  }, []);

  // Handle device visibility changes
  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden;
    const now = new Date();
    
    setState(prev => ({ 
      ...prev, 
      isDeviceAwake: isVisible,
      lastActivity: now
    }));

    if (!isVisible && isRecording) {
      // Page is hidden, start recovery timeout
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
      
      visibilityTimeoutRef.current = setTimeout(() => {
        handleInterruption('visibility-hidden');
      }, mergedConfig.recoveryTimeout);
    } else if (isVisible && visibilityTimeoutRef.current) {
      // Page is visible again, clear timeout
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
      
      // Check if we recovered from an interruption
      if (state.recordingInterrupted) {
        handleRecovery();
      }
    }
  }, [isRecording, mergedConfig.recoveryTimeout, state.recordingInterrupted]);

  // Handle power save mode detection
  const detectPowerSaveMode = useCallback(async () => {
    if (!mergedConfig.enablePowerSaveDetection) return;

    try {
      // Check battery level if available
      if ('getBattery' in navigator) {
        // @ts-ignore - Battery API
        const battery = await navigator.getBattery();
        const isLowPower = battery.level < 0.2 && !battery.charging;
        
        setState(prev => ({ ...prev, isPowerSaveMode: isLowPower }));
        
        if (isLowPower && isRecording) {
          toast({
            title: 'Low Battery Detected',
            description: 'Device is in low power mode. Recording quality may be affected.',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Power save detection failed:', error);
    }
  }, [mergedConfig.enablePowerSaveDetection, isRecording, toast]);

  // Handle recording interruption
  const handleInterruption = useCallback((reason: string) => {
    if (!isRecording) return;

    const now = new Date();
    setState(prev => ({
      ...prev,
      recordingInterrupted: true,
      interruptionCount: prev.interruptionCount + 1,
      lastActivity: now
    }));

    // Store current recording data for recovery
    if (mergedConfig.enableOfflineStorage && offlineDataRef.current.length > 0) {
      saveOfflineData();
    }

    toast({
      title: 'Recording Interrupted',
      description: `Recording was interrupted (${reason}). Attempting automatic recovery...`,
      variant: 'destructive'
    });

    // Start recovery timeout
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }

    recoveryTimeoutRef.current = setTimeout(() => {
      handleRecovery();
    }, mergedConfig.recoveryTimeout);
  }, [isRecording, mergedConfig.enableOfflineStorage, mergedConfig.recoveryTimeout, toast]);

  // Handle recovery from interruption
  const handleRecovery = useCallback(async () => {
    if (!mergedConfig.enableAutoRecovery) return;

    try {
      // Check if we can recover
      if (state.interruptionCount >= mergedConfig.maxInterruptions) {
        throw new Error('Maximum interruption limit reached');
      }

      // Request wake lock again
      await requestWakeLock();

      // Clear recovery timeout
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }

      // Restore from offline data if available
      if (mergedConfig.enableOfflineStorage) {
        await restoreOfflineData();
      }

      setState(prev => ({
        ...prev,
        recordingInterrupted: false,
        lastActivity: new Date()
      }));

      toast({
        title: 'Recording Recovered',
        description: 'Successfully recovered from interruption. Continue speaking.',
        variant: 'default'
      });

    } catch (error) {
      console.error('Recovery failed:', error);
      
      toast({
        title: 'Recovery Failed',
        description: 'Could not recover recording. Please restart the recording.',
        variant: 'destructive'
      });

      // Emit recovery failure event
      window.dispatchEvent(new CustomEvent('recordingRecoveryFailed', { 
        detail: { error, interruptionCount: state.interruptionCount } 
      }));
    }
  }, [mergedConfig.enableAutoRecovery, mergedConfig.enableOfflineStorage, mergedConfig.maxInterruptions, state.interruptionCount, requestWakeLock, toast]);

  // Monitor activity
  const updateActivity = useCallback(() => {
    const now = new Date();
    setState(prev => ({ ...prev, lastActivity: now }));

    // Reset activity timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - now.getTime();
      if (timeSinceActivity > mergedConfig.activityThreshold && isRecording) {
        handleInterruption('inactivity-timeout');
      }
    }, mergedConfig.activityThreshold + 1000);
  }, [isRecording, mergedConfig.activityThreshold]);

  // Save offline data
  const saveOfflineData = useCallback(() => {
    if (!mergedConfig.enableOfflineStorage) return;

    try {
      // Store in localStorage or IndexedDB
      const offlineData = {
        timestamp: new Date().toISOString(),
        data: offlineDataRef.current,
        recordingState: state,
        config: mergedConfig
      };

      localStorage.setItem('recording-offline-data', JSON.stringify(offlineData));
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  }, [mergedConfig.enableOfflineStorage, state, mergedConfig]);

  // Restore offline data
  const restoreOfflineData = useCallback(async () => {
    if (!mergedConfig.enableOfflineStorage) return;

    try {
      const stored = localStorage.getItem('recording-offline-data');
      if (stored) {
        const offlineData = JSON.parse(stored);
        offlineDataRef.current = offlineData.data || [];
        
        // Clear stored data
        localStorage.removeItem('recording-offline-data');
      }
    } catch (error) {
      console.error('Failed to restore offline data:', error);
    }
  }, [mergedConfig.enableOfflineStorage]);

  // Add offline data
  const addOfflineData = useCallback((data: Blob) => {
    if (!mergedConfig.enableOfflineStorage) return;
    
    offlineDataRef.current.push(data);
    updateActivity();
  }, [mergedConfig.enableOfflineStorage, updateActivity]);

  // Setup event listeners
  useEffect(() => {
    const handleVisibilityChangeWrapper = () => handleVisibilityChange();
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = 'Recording is in progress. Are you sure you want to leave?';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChangeWrapper);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Monitor activity
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChangeWrapper);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [handleVisibilityChange, isRecording, updateActivity]);

  // Monitor recording state changes
  useEffect(() => {
    if (isRecording && !state.isRecordingActive) {
      // Recording started
      setState(prev => ({ ...prev, isRecordingActive: true }));
      requestWakeLock();
      detectPowerSaveMode();
      updateActivity();
    } else if (!isRecording && state.isRecordingActive) {
      // Recording stopped
      setState(prev => ({ ...prev, isRecordingActive: false }));
      releaseWakeLock();
      
      // Cleanup timeouts
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    }
  }, [isRecording, state.isRecordingActive, requestWakeLock, releaseWakeLock, detectPowerSaveMode, updateActivity]);

  // Monitor state changes
  useEffect(() => {
    if (state !== lastStateRef.current) {
      lastStateRef.current = state;
      
      // Emit state change event
      window.dispatchEvent(new CustomEvent('recordingPersistenceStateChange', { 
        detail: state 
      }));
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [releaseWakeLock]);

  return {
    state,
    actions: {
      requestWakeLock,
      releaseWakeLock,
      handleInterruption,
      handleRecovery,
      updateActivity,
      addOfflineData
    }
  };
}