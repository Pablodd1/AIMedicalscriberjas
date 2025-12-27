import { WebSocket } from 'ws';
import { log, logError } from './logger';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

interface TranscriptionSession {
  roomId: string;
  deepgramLive: any;
  transcript: string[];
  isActive: boolean;
}

const activeSessions = new Map<string, TranscriptionSession>();

export async function startLiveTranscription(roomId: string, audioWebSocket: WebSocket): Promise<void> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!deepgramApiKey) {
    console.warn('Deepgram API key not configured - live transcription unavailable');
    return;
  }

  try {
    const deepgram = createClient(deepgramApiKey);

    // Create a live transcription connection
    const deepgramLive = deepgram.listen.live({
      model: 'nova-2-medical',
      language: 'en-US',
      smart_format: true,
      punctuate: true,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
      diarize: true, // Identify doctor vs patient speaker
    });

    const session: TranscriptionSession = {
      roomId,
      deepgramLive,
      transcript: [],
      isActive: true
    };

    activeSessions.set(roomId, session);

    // Handle Deepgram events
    deepgramLive.on(LiveTranscriptionEvents.Open, () => {
      log(`✅ Deepgram live transcription started for room: ${roomId}`);
      
      // Notify participants that transcription is active
      audioWebSocket.send(JSON.stringify({
        type: 'transcription-started',
        roomId
      }));
    });

    deepgramLive.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel?.alternatives?.[0];
      if (!transcript) return;

      const text = transcript.transcript;
      if (!text || text.trim().length === 0) return;

      const isFinal = data.is_final;
      const speaker = data.channel?.alternatives?.[0]?.words?.[0]?.speaker || 0;
      const speakerLabel = speaker === 0 ? 'Patient' : 'Doctor';

      if (isFinal) {
        // Store final transcript
        session.transcript.push(`[${speakerLabel}]: ${text}`);
      }

      // Send transcript update to all participants
      audioWebSocket.send(JSON.stringify({
        type: 'live-transcript',
        roomId,
        text,
        isFinal,
        speaker: speakerLabel,
        timestamp: new Date().toISOString()
      }));
    });

    deepgramLive.on(LiveTranscriptionEvents.Error, (error: any) => {
      logError('Deepgram error:', error);
      audioWebSocket.send(JSON.stringify({
        type: 'transcription-error',
        roomId,
        error: 'Transcription service error'
      }));
    });

    deepgramLive.on(LiveTranscriptionEvents.Close, () => {
      log(`🛑 Deepgram connection closed for room: ${roomId}`);
      session.isActive = false;
    });

  } catch (error) {
    logError('Error starting live transcription:', error);
    throw error;
  }
}

export function sendAudioToDeepgram(roomId: string, audioData: Buffer): void {
  const session = activeSessions.get(roomId);
  
  if (!session || !session.isActive) {
    return;
  }

  try {
    // Send audio chunk to Deepgram
    if (session.deepgramLive && session.deepgramLive.send) {
      session.deepgramLive.send(audioData);
    }
  } catch (error) {
    logError('Error sending audio to Deepgram:', error);
  }
}

export async function stopLiveTranscription(roomId: string): Promise<string[]> {
  const session = activeSessions.get(roomId);
  
  if (!session) {
    return [];
  }

  try {
    if (session.deepgramLive) {
      session.deepgramLive.finish();
    }
    
    const fullTranscript = session.transcript;
    activeSessions.delete(roomId);
    
    return fullTranscript;
  } catch (error) {
    logError('Error stopping live transcription:', error);
    return session.transcript;
  }
}

export function getSessionTranscript(roomId: string): string[] {
  const session = activeSessions.get(roomId);
  return session ? session.transcript : [];
}
