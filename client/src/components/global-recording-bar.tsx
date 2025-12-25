import React from 'react';
import { useRecording } from '@/contexts/recording-context';
import { Button } from '@/components/ui/button';
import { Mic, Pause, Play, StopCircle, User, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConsultationModal } from '@/components/consultation-modal';
import { useState } from 'react';

export const GlobalRecordingBar: React.FC = () => {
    const {
        isRecording,
        isPaused,
        duration,
        patientInfo,
        pauseRecording,
        resumeRecording,
        stopRecording
    } = useRecording();

    const [showModal, setShowModal] = useState(false);

    if (!isRecording) return null;

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <div className={cn(
                "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
                "bg-medical-dark-blue text-white shadow-2xl rounded-full border border-medical-yellow/30 p-1 pl-4 flex items-center gap-4 min-w-[300px] max-w-[90vw]"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "h-3 w-3 rounded-full animate-pulse",
                        isPaused ? "bg-yellow-400" : "bg-red-500"
                    )} />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-medical-yellow font-bold uppercase tracking-wider flex items-center gap-1">
                            <Clock className="h-2 w-2" /> {formatDuration(duration)}
                        </span>
                        <span className="text-xs font-semibold truncate max-w-[120px]">
                            {patientInfo ? `${patientInfo.firstName} ${patientInfo.lastName || ""}` : "Consultation"}
                        </span>
                    </div>
                </div>

                <div className="h-8 w-px bg-white/10" />

                <div className="flex items-center gap-1 pr-1">
                    {isPaused ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-white/10 text-white"
                            onClick={resumeRecording}
                        >
                            <Play className="h-4 w-4 fill-current" />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-white/10 text-white"
                            onClick={pauseRecording}
                        >
                            <Pause className="h-4 w-4" />
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-medical-red/20 text-medical-red"
                        onClick={() => setShowModal(true)}
                    >
                        <StopCircle className="h-5 w-5 fill-current" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 pr-2 pl-3 rounded-full bg-medical-yellow text-medical-dark-blue hover:bg-medical-yellow/90 font-bold text-xs"
                        onClick={() => setShowModal(true)}
                    >
                        VIEW
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <ConsultationModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                patientInfo={patientInfo}
                onGeneratedNotes={() => { }}
            />
        </>
    );
};
