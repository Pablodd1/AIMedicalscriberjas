import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Video, 
  Phone, 
  Calendar, 
  Users, 
  MessageSquare, 
  Mic, 
  MicOff, 
  VideoOff,
  X,
  MessageCircle,
  PlusCircle,
  Send,
  Circle,
  Square,
  FileText,
  Loader2,
  Printer,
  Download
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogClose,
  DialogContent, 
  DialogDescription,
  DialogFooter,
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Patient, Appointment } from "@shared/schema";

interface VideoConsultationProps {
  roomId: string;
  patient: Patient;
  onClose: () => void;
}

function VideoConsultation({ roomId, patient, onClose }: VideoConsultationProps) {
  // For patient join URL - make sure it includes the roomId parameter
  const patientJoinUrl = `${window.location.origin}/join-consultation/${roomId}`;
  console.log("Generated patient join URL:", patientJoinUrl);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedTime, setRecordedTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  
  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Recording functions
  const startRecording = () => {
    if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
      toast({
        title: "Recording Error",
        description: "Cannot start recording. No remote stream available.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Reset recording state
      recordedChunksRef.current = [];
      setRecordedTime(0);
      
      // Create a mixed audio stream from both local and remote audio
      const audioContext = new AudioContext();
      
      // Get audio from remote stream (patient's voice)
      const remoteStream = remoteVideoRef.current.srcObject as MediaStream;
      const remoteAudio = audioContext.createMediaStreamSource(remoteStream);
      
      // Get audio from local stream (doctor's voice)
      let localAudio = null;
      if (localStreamRef.current) {
        localAudio = audioContext.createMediaStreamSource(localStreamRef.current);
      }
      
      // Create a destination for the mixed audio
      const destination = audioContext.createMediaStreamDestination();
      
      // Add gain nodes to ensure good audio levels
      const remoteGain = audioContext.createGain();
      remoteGain.gain.value = 1.0; // Normal volume for remote (patient)
      
      // Connect the audio sources to gain nodes
      remoteAudio.connect(remoteGain);
      remoteGain.connect(destination);
      
      if (localAudio) {
        const localGain = audioContext.createGain();
        localGain.gain.value = 1.2; // Slightly boosted volume for local (doctor)
        localAudio.connect(localGain);
        localGain.connect(destination);
      }
      
      // Try to use highest quality audio
      let options = {};
      
      // Try different audio formats in order of preference
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options = { 
            mimeType,
            audioBitsPerSecond: 128000 // Higher bitrate for better quality
          };
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(destination.stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle dataavailable event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      // Update recorded time every second
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordedTime(currentTime => {
          // Request more data every 5 seconds to ensure continuous recording
          if (mediaRecorderRef.current && currentTime % 5 === 0) {
            mediaRecorderRef.current.requestData();
          }
          return currentTime + 1;
        });
      }, 1000);
      
      toast({
        title: "Recording Started",
        description: "Consultation recording has started. Both participants' audio will be captured.",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const stopRecording = async () => {
    if (!mediaRecorderRef.current) {
      return;
    }
    
    return new Promise<void>((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        // Stop the timer
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        
        // Set up the ondataavailable and onstop event handlers
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorderRef.current.onstop = async () => {
          setIsRecording(false);
          
          // Generate the audio blob
          const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          
          // Create a simple transcript if API fails
          let backupTranscriptText = "";
          
          // Save conversation to transcript even if API fails
          messages.forEach(msg => {
            backupTranscriptText += `${msg.sender}: ${msg.text}\n`;
          });
          
          toast({
            title: "Transcribing Audio",
            description: "Processing the recorded consultation...",
          });
          
          try {
            // Create an audio element to convert to MP3
            const audioElement = document.createElement('audio');
            audioElement.src = URL.createObjectURL(audioBlob);
            
            // Convert webm to mp3 format by sending to server
            const formDataMp3 = new FormData();
            formDataMp3.append('audio', audioBlob, 'consultation_original.webm');
            formDataMp3.append('roomId', roomId);
            
            // Save recording in the database first
            const recordingResponse = await fetch('/api/telemedicine/recordings', {
              method: 'POST',
              body: formDataMp3,
            });
            
            if (!recordingResponse.ok) {
              console.error('Error saving recording:', recordingResponse.status);
            }
            
            // Offer MP3 conversion through server API
            const mp3Response = await fetch('/api/telemedicine/convert-to-mp3', {
              method: 'POST',
              body: formDataMp3,
            });
            
            let mp3Url = null;
            let mp3Blob = null;
            
            if (mp3Response.ok) {
              mp3Blob = await mp3Response.blob();
              mp3Url = URL.createObjectURL(mp3Blob);
            }
            
            // Create the download link (using MP3 if conversion worked, webm as fallback)
            const audioUrl = mp3Url || URL.createObjectURL(audioBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = audioUrl;
            downloadLink.download = `consultation_${roomId}_${new Date().toISOString()}.${mp3Url ? 'mp3' : 'webm'}`;
            
            // Create a fallback timestamp-based transcript
            const timestamp = new Date().toISOString();
            
            // Send the audio to the backend for transcription
            const formData = new FormData();
            formData.append('audio', audioBlob, 'consultation.webm');
            
            const response = await fetch('/api/ai/transcribe', {
              method: 'POST',
              body: formData,
            });
            
            if (!response.ok) {
              throw new Error(`Transcription failed: ${response.status}`);
            }
            
            const data = await response.json();
            setTranscription(data.text);
            
            toast({
              title: "Transcription Complete",
              description: "Consultation has been recorded and transcribed.",
            });
            
            // Offer to download the audio file
            toast({
              title: "Audio Recording Ready",
              description: <div className="flex items-center gap-2">
                <span>Audio file is ready.</span>
                <Button variant="outline" size="sm" onClick={() => downloadLink.click()}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>,
              duration: 10000,
            });
            
          } catch (error) {
            console.error('Error transcribing audio:', error);
            
            // Use backup transcript instead
            setTranscription(`--- CONSULTATION TRANSCRIPT ---\n\nDate: ${new Date().toLocaleString()}\nPatient: ${patient.name}\n\n${backupTranscriptText}\n\n--- END OF TRANSCRIPT ---`);
            
            toast({
              title: "Transcription Created",
              description: "Using chat messages as fallback for transcription.",
              variant: "default"
            });
          }
          
          resolve();
        };
        
        // Request more data before stopping to ensure we capture everything
        mediaRecorderRef.current.requestData();
        
        // Stop recording after a short delay to ensure all data is captured
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }, 500);
      } else {
        resolve();
      }
    });
  };
  
  const createMedicalNote = async () => {
    if (!transcription) {
      toast({
        title: "No Transcription",
        description: "Please record and transcribe the consultation first.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Generate SOAP notes from the transcription
      const response = await fetch('/api/ai/generate-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcription,
          patientInfo: patient
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Note generation failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Save the consultation note
      const consultationResponse = await fetch('/api/consultation-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: patient.id,
          content: transcription,
          title: `Consultation with ${patient.name} - ${new Date().toLocaleDateString()}`
        }),
      });
      
      if (!consultationResponse.ok) {
        throw new Error(`Failed to save consultation: ${consultationResponse.status}`);
      }
      
      const consultationData = await consultationResponse.json();
      
      // Save the medical note
      const medicalNoteResponse = await fetch('/api/medical-notes/from-consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultationId: consultationData.id,
          patientId: patient.id,
          content: data.notes,
          title: `SOAP Notes: ${patient.name} - ${new Date().toLocaleDateString()}`,
          type: 'soap'
        }),
      });
      
      if (!medicalNoteResponse.ok) {
        throw new Error(`Failed to save medical note: ${medicalNoteResponse.status}`);
      }
      
      toast({
        title: "Note Created",
        description: "Medical note has been generated and saved from the consultation.",
      });
    } catch (error) {
      console.error('Error creating medical note:', error);
      toast({
        title: "Note Creation Error",
        description: "Failed to generate and save the medical note.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    // Initialize WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Connecting to WebSocket at:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connection established');
      
      // Join the room
      if (wsRef.current && user) {
        wsRef.current.send(JSON.stringify({
          type: 'join',
          roomId,
          userId: user.id.toString(),
          name: user.name,
          isDoctor: true
        }));
      }
    };
    
    wsRef.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'welcome':
          console.log('Received welcome message from server:', message.message);
          break;
          
        case 'room-users':
          setParticipants(message.users);
          break;
          
        case 'user-joined':
          toast({
            title: "Participant joined",
            description: `${message.name} has joined the consultation`,
          });
          setParticipants(prev => [...prev, {
            id: message.userId,
            name: message.name,
            isDoctor: message.isDoctor
          }]);
          
          // If this is the patient joining, initiate the call
          if (!message.isDoctor) {
            startCall(message.userId);
          }
          break;
          
        case 'user-left':
          toast({
            title: "Participant left",
            description: "A participant has left the consultation",
          });
          setParticipants(prev => prev.filter(p => p.id !== message.userId));
          break;
          
        case 'offer':
          handleOffer(message);
          break;
          
        case 'answer':
          handleAnswer(message);
          break;
          
        case 'ice-candidate':
          handleICECandidate(message);
          break;
          
        case 'chat-message':
          setMessages(prev => [...prev, {
            sender: message.senderName,
            text: message.text
          }]);
          break;
          
        case 'error':
          toast({
            title: "Error",
            description: message.message,
            variant: "destructive"
          });
          break;
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to the consultation server",
        variant: "destructive"
      });
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed');
      setConnected(false);
    };
    
    // Get user media and initialize local video
    initializeMedia();
    
    // Cleanup function
    return () => {
      // Stop recording if it's in progress
      if (isRecording) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      // Stop media streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, user]);
  
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setConnected(true);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: "Media Error",
        description: "Could not access camera or microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };
  
  const startCall = async (targetUserId: string) => {
    try {
      // Create new RTCPeerConnection
      peerConnectionRef.current = new RTCPeerConnection(configuration);
      
      // Add local stream tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (localStreamRef.current && peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(track, localStreamRef.current);
          }
        });
      }
      
      // Set up event handlers for peer connection
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate to the other peer
          if (wsRef.current && roomId) {
            console.log('Doctor sending ICE candidate with room ID:', roomId);
            wsRef.current.send(JSON.stringify({
              type: 'ice-candidate',
              target: targetUserId,
              sender: user?.id.toString(),
              roomId: roomId,
              data: event.candidate
            }));
          }
        }
      };
      
      peerConnectionRef.current.ontrack = (event) => {
        // Set remote stream to video element
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      if (wsRef.current && roomId) {
        console.log('Doctor sending offer with room ID:', roomId);
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          target: targetUserId,
          sender: user?.id.toString(),
          roomId: roomId,
          data: offer
        }));
      }
    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: "Call Error",
        description: "Failed to initiate video call",
        variant: "destructive"
      });
    }
  };
  
  const handleOffer = async (message: any) => {
    try {
      // Create new RTCPeerConnection if it doesn't exist
      if (!peerConnectionRef.current) {
        peerConnectionRef.current = new RTCPeerConnection(configuration);
        
        // Add local stream tracks to peer connection
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            if (localStreamRef.current && peerConnectionRef.current) {
              peerConnectionRef.current.addTrack(track, localStreamRef.current);
            }
          });
        }
        
        // Set up event handlers for peer connection
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            // Send ICE candidate to the other peer
            if (wsRef.current && roomId) {
              console.log('Doctor responding with ICE candidate, room ID:', roomId);
              wsRef.current.send(JSON.stringify({
                type: 'ice-candidate',
                target: message.sender,
                sender: user?.id.toString(),
                roomId: roomId,
                data: event.candidate
              }));
            }
          }
        };
        
        peerConnectionRef.current.ontrack = (event) => {
          // Set remote stream to video element
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
      }
      
      // Set remote description from offer
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.data));
      
      // Create and send answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (wsRef.current && roomId) {
        console.log('Doctor sending answer with room ID:', roomId);
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          target: message.sender,
          sender: user?.id.toString(),
          roomId: roomId,
          data: answer
        }));
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      toast({
        title: "Call Error",
        description: "Failed to accept incoming call",
        variant: "destructive"
      });
    }
  };
  
  const handleAnswer = async (message: any) => {
    try {
      if (peerConnectionRef.current) {
        console.log('Received answer message:', message);
        // Check if message format is correct
        if (message.answer) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.data) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.data));
        } else {
          console.error('Invalid answer format:', message);
          toast({
            title: "Connection Error",
            description: "Failed to establish connection. Invalid answer format.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      toast({
        title: "Connection Error",
        description: "Failed to establish connection with patient.",
        variant: "destructive"
      });
    }
  };
  
  const handleICECandidate = async (message: any) => {
    try {
      if (peerConnectionRef.current) {
        console.log('Doctor received ICE candidate message:', message);
        
        // Handle different message formats
        let candidate;
        
        if (message.candidate) {
          // Direct candidate format
          candidate = message.candidate;
        } else if (message.data && message.data.candidate) {
          // Nested candidate format
          candidate = message.data;
        } else if (message.data) {
          // Direct data format
          candidate = message.data;
        }
        
        if (candidate) {
          try {
            // Log what we're trying to add
            console.log('Doctor adding ICE candidate:', candidate);
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Doctor successfully added ICE candidate');
          } catch (err) {
            console.error('Doctor error adding specific ICE candidate:', err, candidate);
            // If it fails, try with a simpler version of the candidate
            if (typeof candidate === 'object' && candidate.candidate) {
              try {
                const simpleCandidate = {
                  candidate: candidate.candidate,
                  sdpMLineIndex: candidate.sdpMLineIndex || 0,
                  sdpMid: candidate.sdpMid || '0'
                };
                console.log('Doctor trying simplified candidate:', simpleCandidate);
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(simpleCandidate));
                console.log('Doctor successfully added simplified ICE candidate');
              } catch (simplifiedErr) {
                console.error('Doctor failed to add simplified candidate:', simplifiedErr);
              }
            }
          }
        } else {
          console.error('Invalid ICE candidate format:', message);
        }
      } else {
        console.error('Doctor cannot add ICE candidate - no peer connection exists');
      }
    } catch (error) {
      console.error('Error in ICE candidate handler:', error);
    }
  };
  
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };
  
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };
  
  const sendChatMessage = () => {
    if (messageText.trim() && wsRef.current) {
      const message = {
        type: 'chat-message',
        sender: user?.id.toString(),
        senderName: user?.name,
        text: messageText,
        roomId
      };
      
      wsRef.current.send(JSON.stringify(message));
      
      // Add message to local state
      setMessages(prev => [...prev, {
        sender: user?.name || "You",
        text: messageText
      }]);
      
      // Clear input
      setMessageText("");
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)] overflow-hidden">
      <div className="flex justify-between items-center p-2 border-b">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{patient.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">{patient.name}</h3>
            <p className="text-xs text-muted-foreground">Video Consultation</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="ml-2">
                <Users className="h-4 w-4 mr-1" />
                Share Info
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Consultation</DialogTitle>
                <DialogDescription>
                  Share this information with patients to join the consultation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Complete Patient Join URL</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Share this complete URL with the patient. It contains the necessary room ID.
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={patientJoinUrl} readOnly />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(patientJoinUrl);
                        toast({
                          title: "URL Copied",
                          description: "Complete patient join URL copied to clipboard",
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Room ID (for manual entry)</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    If the patient needs to enter the room ID manually, share this code.
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={roomId} readOnly className="font-mono" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(roomId);
                        toast({
                          title: "ID Copied",
                          description: "Room ID copied to clipboard",
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setChatOpen(!chatOpen)} 
            variant="outline" 
            size="icon"
            className={chatOpen ? "bg-primary text-primary-foreground" : ""}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 flex flex-col ${chatOpen ? 'w-2/3' : 'w-full'}`}>
          <div className="relative flex-1 bg-muted">
            {/* Main remote video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-black"
            />
            
            {/* Local video (pip) */}
            <div className="absolute bottom-4 right-4 w-1/4 max-w-[200px] rounded-lg overflow-hidden shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-gray-800"
              />
            </div>
          </div>
          
          <div className="p-2 bg-background">
            <Sheet>
              <div className="flex items-center justify-between mb-4">
                {transcription ? (
                  <SheetTrigger asChild>
                    <Button variant="outline" className="mr-auto">
                      <FileText className="h-4 w-4 mr-2" />
                      View Transcription
                    </Button>
                  </SheetTrigger>
                ) : (
                  <div className="flex items-center gap-2">
                    {isRecording ? (
                      <>
                        <Button variant="outline" onClick={stopRecording} size="sm">
                          <Square className="h-4 w-4 mr-2" />
                          Stop Recording
                        </Button>
                        <div className="flex items-center bg-muted px-2 py-1 rounded-md">
                          <span className="animate-pulse h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                          <span className="text-xs font-medium">
                            {Math.floor(recordedTime / 60)}:{(recordedTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </>
                    ) : (
                      <Button variant="outline" onClick={startRecording} size="sm">
                        <Circle className="h-4 w-4 mr-2 fill-red-500" />
                        Record Meeting
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Consultation Transcription</SheetTitle>
                  <SheetDescription>
                    Generated transcript from the recorded consultation
                  </SheetDescription>
                </SheetHeader>
                
                <div className="my-6">
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    <p className="text-sm whitespace-pre-wrap">{transcription}</p>
                  </ScrollArea>
                </div>
                
                <SheetFooter>
                  <Button onClick={createMedicalNote}>
                    <FileText className="h-4 w-4 mr-2" />
                    Create SOAP Note
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            
            <div className="flex justify-center gap-2">
              <Button 
                onClick={toggleAudio} 
                variant={audioEnabled ? "outline" : "destructive"}
                size="icon"
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button 
                onClick={toggleVideo} 
                variant={videoEnabled ? "outline" : "destructive"}
                size="icon"
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button variant="destructive" onClick={onClose}>
                End Call
              </Button>
            </div>
          </div>
        </div>
        
        {chatOpen && (
          <div className="w-1/3 border-l flex flex-col h-full">
            <div className="p-4 border-b">
              <h3 className="font-medium">Chat</h3>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className="flex flex-col">
                    <p className="text-xs font-medium text-muted-foreground">{msg.sender}</p>
                    <div className="bg-muted rounded-lg p-3 mt-1 inline-block">
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No messages yet
                  </p>
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t flex gap-2">
              <Input 
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
              />
              <Button onClick={sendChatMessage} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StartConsultationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartConsultation: (patient: Patient) => void;
}

function StartConsultationDialog({ isOpen, onClose, onStartConsultation }: StartConsultationDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });
  
  const filteredPatients = patients?.filter(patient => 
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Video Consultation</DialogTitle>
          <DialogDescription>
            Select a patient to start a video consultation with.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Input
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />
          
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {isLoading ? (
                <p className="text-center py-4 text-muted-foreground">Loading patients...</p>
              ) : filteredPatients?.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No patients found</p>
              ) : (
                filteredPatients?.map(patient => (
                  <div 
                    key={patient.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                    onClick={() => onStartConsultation(patient)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{patient.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-sm text-muted-foreground">{patient.email}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Video className="h-4 w-4 mr-2" />
                      Select
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Function to format duration from seconds to mm:ss
function formatDuration(seconds?: number): string {
  if (!seconds) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// RecordingDetailsDialog component
interface RecordingDetailsDialogProps {
  recording: RecordingSession | null;
  isOpen: boolean;
  onClose: () => void;
}

function RecordingDetailsDialog({ recording, isOpen, onClose }: RecordingDetailsDialogProps) {
  const { toast } = useToast();
  
  // Use the recording data directly to get real-time updates
  const generateTranscriptMutation = useMutation({
    mutationFn: async (recordingId: number) => {
      const res = await apiRequest("PATCH", `/api/telemedicine/recordings/${recordingId}/generate-transcript`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Transcript generated",
        description: "The consultation transcript has been generated successfully.",
      });
      // Invalidate the recordings cache to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/telemedicine/recordings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate transcript",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const generateSoapNoteMutation = useMutation({
    mutationFn: async (recordingId: number) => {
      const res = await apiRequest("POST", `/api/telemedicine/recordings/${recordingId}/generate-note`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "SOAP note generated",
        description: "Medical note has been created based on the consultation.",
      });
      // Invalidate the recordings cache to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/telemedicine/recordings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate SOAP note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateTranscript = () => {
    if (recording) {
      generateTranscriptMutation.mutate(recording.id);
    }
  };
  
  const handleGenerateSoapNote = () => {
    if (recording) {
      generateSoapNoteMutation.mutate(recording.id);
    }
  };

  if (!recording) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recording Details</DialogTitle>
          <DialogDescription>
            View and manage recording details for this consultation.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 mt-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h3 className="font-medium text-lg">
                Consultation with {recording.patient?.name || 'Unknown Patient'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Room ID: {recording.roomId}
              </p>
            </div>
            <div className="text-right">
              <Badge variant={recording.status === 'completed' ? 'success' : 'default'} className="capitalize mb-2">
                {recording.status}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {new Date(recording.startTime).toLocaleString()}
              </p>
              {recording.duration && (
                <p className="text-sm text-muted-foreground">
                  Duration: {formatDuration(recording.duration)}
                </p>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="text-sm font-medium mb-2">Transcript</h4>
            {recording.transcript ? (
              <ScrollArea className="h-64 rounded-md border p-4">
                <p className="whitespace-pre-wrap">{recording.transcript}</p>
              </ScrollArea>
            ) : (
              <div className="h-64 rounded-md border flex items-center justify-center">
                {generateTranscriptMutation.isPending ? (
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Generating transcript...</p>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <p className="mb-2 text-muted-foreground">No transcript available</p>
                    <Button variant="outline" onClick={handleGenerateTranscript}>
                      <Mic className="h-4 w-4 mr-2" />
                      Generate Transcript
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {recording.notes && (
            <div>
              <h4 className="text-sm font-medium mb-2">Notes</h4>
              <div className="rounded-md border p-4">
                <p className="whitespace-pre-wrap">{recording.notes}</p>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {recording.transcript && !recording.notes && (
            <Button onClick={handleGenerateSoapNote} disabled={generateSoapNoteMutation.isPending}>
              {generateSoapNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate SOAP Note
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// RecordingSession type
interface RecordingSession {
  id: number;
  roomId: string;
  patientId: number;
  doctorId: number;
  startTime: string; // ISO date string
  endTime?: string; // ISO date string
  duration?: number; // In seconds
  status: 'active' | 'completed';
  transcript?: string | null;
  notes?: string | null;
  patient?: any; // Patient data will be included from API
}

export default function Telemedicine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [activeConsultation, setActiveConsultation] = useState<{
    roomId: string;
    patient: Patient;
  } | null>(null);
  
  // State for recording details dialog
  const [showRecordingDetails, setShowRecordingDetails] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<RecordingSession | null>(null);
  
  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });
  
  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });
  
  // Fetch recording sessions
  const { data: recordings, isLoading: loadingRecordings } = useQuery<RecordingSession[]>({
    queryKey: ["/api/telemedicine/recordings"],
  });
  
  const createRoomMutation = useMutation({
    mutationFn: async (patientData: { patientId: number, patientName: string }) => {
      const res = await apiRequest("POST", "/api/telemedicine/rooms", patientData);
      return res.json();
    },
    onSuccess: (data, variables) => {
      if (patients) {
        const patient = patients.find(p => p.id === variables.patientId);
        if (patient) {
          setActiveConsultation({
            roomId: data.roomId,
            patient
          });
          
          toast({
            title: "Consultation started",
            description: `Video consultation with ${patient.name} is ready.`,
          });
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start consultation",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleStartConsultation = (patient: Patient) => {
    setShowStartDialog(false);
    
    createRoomMutation.mutate({
      patientId: patient.id,
      patientName: patient.name
    });
  };
  
  const handleEndConsultation = () => {
    setActiveConsultation(null);
    
    toast({
      title: "Consultation ended",
      description: "Video consultation has been ended.",
    });
  };
  
  return (
    <>
      {activeConsultation ? (
        <div className="h-[calc(100vh-theme(spacing.16))]">
          <VideoConsultation 
            roomId={activeConsultation.roomId}
            patient={activeConsultation.patient}
            onClose={handleEndConsultation}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Telemedicine</h1>
              <p className="text-muted-foreground">Manage virtual consultations</p>
            </div>
            <Button onClick={() => setShowStartDialog(true)}>
              <Video className="h-4 w-4 mr-2" />
              Start Consultation
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{
                  appointments?.filter(a => 
                    a.type === 'telemedicine' && 
                    new Date(a.date) > new Date() && 
                    a.status !== 'cancelled'
                  ).length || 0
                }</div>
                <p className="text-xs text-muted-foreground">Scheduled telemedicine sessions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{
                  appointments?.filter(a => {
                    const appointmentDate = new Date(a.date);
                    const today = new Date();
                    return (
                      appointmentDate.getDate() === today.getDate() &&
                      appointmentDate.getMonth() === today.getMonth() &&
                      appointmentDate.getFullYear() === today.getFullYear() &&
                      a.status !== 'cancelled'
                    );
                  }).length || 0
                }</div>
                <p className="text-xs text-muted-foreground">Appointments for today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Sessions</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recordings?.filter(r => r.status === 'completed').length || 0}</div>
                <p className="text-xs text-muted-foreground">Total completed consultations</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Virtual Waiting Room</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments && patients ? (
                <div className="space-y-4">
                  {appointments
                    .filter(appointment => 
                      appointment.type === 'telemedicine' && 
                      new Date(appointment.date) > new Date() &&
                      appointment.status !== 'cancelled'
                    )
                    .map(appointment => {
                      const patient = patients.find(p => p.id === appointment.patientId);
                      if (!patient) return null;
                      
                      const appointmentTime = new Date(appointment.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      
                      const initials = patient.name.split(' ').map(n => n[0]).join('');
                      
                      return (
                        <div
                          key={appointment.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{patient.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Scheduled: {appointmentTime} - {appointment.reason || 'Telemedicine consultation'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="icon"
                              onClick={() => handleStartConsultation(patient)}
                            >
                              <Video className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              ) : (
                <div className="flex justify-center p-4">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              )}
              
              {appointments?.filter(a => a.type === 'telemedicine' && new Date(a.date) > new Date()).length === 0 && (
                <div className="text-center p-6 text-muted-foreground">
                  <p>No upcoming telemedicine appointments.</p>
                  <p className="text-sm mt-1">Schedule appointments from the Appointments page.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Past Recordings</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="ml-2">
                  <FileText className="h-3 w-3 mr-1" />
                  {recordings?.length || 0} Recordings
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRecordings ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : recordings && recordings.length > 0 ? (
                <div className="space-y-4">
                  {recordings.map((recording) => (
                    <div key={recording.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {recording.patient?.name?.split(' ').map((n: string) => n[0]).join('') || 'P'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{recording.patient?.name || 'Unknown Patient'}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(recording.startTime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={recording.status === 'completed' ? 'success' : 'default'}
                          className="capitalize"
                        >
                          {recording.status}
                        </Badge>
                      </div>
                      
                      {recording.duration && (
                        <div className="text-sm text-muted-foreground mb-2">
                          Duration: {Math.floor(recording.duration / 60)}m {recording.duration % 60}s
                        </div>
                      )}
                      
                      {recording.transcript && (
                        <div className="mt-2">
                          <p className="text-sm font-medium mb-1">Transcript:</p>
                          <div className="text-sm text-muted-foreground max-h-20 overflow-y-auto p-2 bg-muted/20 rounded">
                            {recording.transcript.substring(0, 150)}
                            {recording.transcript.length > 150 ? '...' : ''}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedRecording(recording);
                            setShowRecordingDetails(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <p>No past recordings found.</p>
                  <p className="text-sm mt-1">Start a new telemedicine session to record a consultation.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <StartConsultationDialog 
            isOpen={showStartDialog}
            onClose={() => setShowStartDialog(false)}
            onStartConsultation={handleStartConsultation}
          />
          
          <RecordingDetailsDialog
            recording={selectedRecording}
            isOpen={showRecordingDetails}
            onClose={() => setShowRecordingDetails(false)}
          />
        </div>
      )}
    </>
  );
}
