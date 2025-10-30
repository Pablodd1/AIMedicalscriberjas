import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface UploadItem {
  id: number;
  recordingId: number;
  blob: Blob;
  filename: string;
  type: 'video' | 'audio';
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface UploadManagerContextType {
  uploads: UploadItem[];
  enqueueUpload: (item: Omit<UploadItem, 'status' | 'progress'>) => void;
  cancelUpload: (id: number) => void;
  retryUpload: (id: number) => void;
  hasActiveUploads: boolean;
}

const UploadManagerContext = createContext<UploadManagerContextType | undefined>(undefined);

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const { toast } = useToast();

  const hasActiveUploads = uploads.some(u => u.status === 'uploading' || u.status === 'pending');

  // Process upload queue
  const processUpload = useCallback(async (upload: UploadItem) => {
    const formData = new FormData();
    formData.append('media', upload.blob, upload.filename);
    formData.append('type', upload.type);

    try {
      // Update status to uploading
      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, status: 'uploading' as const } : u
      ));

      console.log(`[UploadManager] Starting upload for recording ${upload.recordingId}, size: ${(upload.blob.size / 1024 / 1024).toFixed(2)} MB`);

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 1800000); // 30 minute timeout

      const response = await fetch(`/api/telemedicine/recordings/${upload.recordingId}/media`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const responseData = await response.json();
      console.log(`[UploadManager] Upload completed successfully:`, responseData);

      // Update status to completed
      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, status: 'completed' as const, progress: 100 } : u
      ));

      // Show success toast
      toast({
        title: "Upload Complete",
        description: `Recording uploaded successfully to cloud storage`,
      });

      // Refresh recordings list
      queryClient.invalidateQueries({ queryKey: ["/api/telemedicine/recordings"] });

      // Remove from queue after 3 seconds
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== upload.id));
      }, 3000);

    } catch (error) {
      console.error(`[UploadManager] Upload failed:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update status to failed
      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, status: 'failed' as const, error: errorMessage } : u
      ));

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [toast]);

  // Auto-process pending uploads
  useEffect(() => {
    const pendingUpload = uploads.find(u => u.status === 'pending');
    if (pendingUpload) {
      processUpload(pendingUpload);
    }
  }, [uploads, processUpload]);

  const enqueueUpload = useCallback((item: Omit<UploadItem, 'status' | 'progress'>) => {
    const newUpload: UploadItem = {
      ...item,
      status: 'pending',
      progress: 0,
    };
    
    console.log(`[UploadManager] Enqueuing upload for recording ${item.recordingId}`);
    setUploads(prev => [...prev, newUpload]);
    
    toast({
      title: "Upload Queued",
      description: "Recording will upload in the background. You can safely close the meeting.",
    });
  }, [toast]);

  const cancelUpload = useCallback((id: number) => {
    setUploads(prev => prev.filter(u => u.id !== id));
    toast({
      title: "Upload Cancelled",
      description: "Recording upload has been cancelled",
    });
  }, [toast]);

  const retryUpload = useCallback((id: number) => {
    setUploads(prev => prev.map(u => 
      u.id === id ? { ...u, status: 'pending' as const, error: undefined } : u
    ));
  }, []);

  // Warn before closing browser if uploads are active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveUploads) {
        e.preventDefault();
        e.returnValue = 'Recording uploads are in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasActiveUploads]);

  return (
    <UploadManagerContext.Provider value={{
      uploads,
      enqueueUpload,
      cancelUpload,
      retryUpload,
      hasActiveUploads,
    }}>
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const context = useContext(UploadManagerContext);
  if (!context) {
    throw new Error('useUploadManager must be used within UploadManagerProvider');
  }
  return context;
}
