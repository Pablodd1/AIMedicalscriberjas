import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { recordingService } from '@/lib/recording-service';
import { useToast } from '@/hooks/use-toast';

interface RecordingState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    liveTranscript: string;
    audioLevel: number;
    patientInfo: any | null;
    consultationId: number | null;
    error: string | null;
}

interface RecordingContextType extends RecordingState {
    startRecording: (patientInfo?: any) => Promise<void>;
    stopRecording: () => Promise<string>;
    pauseRecording: () => void;
    resumeRecording: () => void;
    setPatientInfo: (info: any) => void;
    setConsultationId: (id: number | null) => void;
    resetRecording: () => void;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { toast } = useToast();
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [liveTranscript, setLiveTranscript] = useState("");
    const [audioLevel, setAudioLevel] = useState(0);
    const [patientInfo, setPatientInfoState] = useState<any | null>(null);
    const [consultationId, setConsultationId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const stopAudioLevelMonitoring = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setAudioLevel(0);
    }, []);

    const startAudioLevelMonitoring = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateLevel = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / bufferLength;
                const normalizedLevel = Math.min(100, (average / 128) * 100);
                setAudioLevel(normalizedLevel);
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };

            updateLevel();
        } catch (error) {
            console.error("Audio level monitoring failed:", error);
        }
    }, []);

    const startRecording = useCallback(async (info?: any) => {
        try {
            setError(null);
            if (info) setPatientInfoState(info);

            await recordingService.startRecording();
            setIsRecording(true);
            setIsPaused(false);
            setDuration(0);
            setLiveTranscript("");

            // Start duration timer
            durationIntervalRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            // Start audio level monitoring
            startAudioLevelMonitoring();

            // Start live transcription
            try {
                await (recordingService as any).startLiveTranscription(
                    (text: string) => setLiveTranscript(text),
                    (error: string) => console.error("Live transcription error:", error)
                );
            } catch (e) {
                console.log("Live transcription not available");
            }

            toast({
                title: "Recording Started",
                description: info ? `Recording for ${info.firstName} ${info.lastName || ""}` : "Recording consultation",
            });
        } catch (error: any) {
            console.error("Context start recording failed:", error);
            setError(error.message || "Could not start recording");
            toast({
                title: "Recording Failed",
                description: error.message || "Could not start recording",
                variant: "destructive",
            });
            throw error;
        }
    }, [startAudioLevelMonitoring, toast]);

    const pauseRecording = useCallback(() => {
        recordingService.pauseRecording();
        setIsPaused(true);
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        toast({
            title: "Recording Paused",
            description: "Audio capture is temporarily suspended",
        });
    }, [toast]);

    const resumeRecording = useCallback(() => {
        recordingService.resumeRecording();
        setIsPaused(false);
        durationIntervalRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
        toast({
            title: "Recording Resumed",
            description: "Audio capture is now active",
        });
    }, [toast]);

    const stopRecording = useCallback(async () => {
        try {
            setIsRecording(false);
            setIsPaused(false);

            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }

            stopAudioLevelMonitoring();
            (recordingService as any).stopLiveTranscription();
            await recordingService.stopRecording();

            const transcript = (recordingService as any).getLiveTranscript() || liveTranscript;

            toast({
                title: "Recording Stopped",
                description: "Audio processing complete",
            });

            return transcript;
        } catch (error: any) {
            console.error("Context stop recording failed:", error);
            setError(error.message || "Error processing recording");
            toast({
                title: "Stop Failed",
                description: error.message || "Error processing recording",
                variant: "destructive",
            });
            throw error;
        }
    }, [liveTranscript, stopAudioLevelMonitoring, toast]);

    const resetRecording = useCallback(() => {
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
        setLiveTranscript("");
        setAudioLevel(0);
        setConsultationId(null);
        setPatientInfoState(null);
        setError(null);
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        stopAudioLevelMonitoring();
    }, [stopAudioLevelMonitoring]);

    const setPatientInfo = useCallback((info: any) => {
        setPatientInfoState(info);
    }, []);

    return (
        <RecordingContext.Provider
            value={{
                isRecording,
                isPaused,
                duration,
                liveTranscript,
                audioLevel,
                patientInfo,
                consultationId,
                error,
                startRecording,
                stopRecording,
                pauseRecording,
                resumeRecording,
                setPatientInfo,
                setConsultationId,
                resetRecording,
            }}
        >
            {children}
        </RecordingContext.Provider>
    );
};

export const useRecording = () => {
    const context = useContext(RecordingContext);
    if (context === undefined) {
        throw new Error('useRecording must be used within a RecordingProvider');
    }
    return context;
};
