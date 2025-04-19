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
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Patient } from "@shared/schema";

interface VideoConsultationProps {
  roomId: string;
  patient: Patient;
  onClose: () => void;
}

function VideoConsultation({ roomId, patient, onClose }: VideoConsultationProps) {
  // For patient join URL
  const patientJoinUrl = `${window.location.origin}/patient-join`;
  
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
      
      // Connect the audio sources to the destination
      remoteAudio.connect(destination);
      if (localAudio) {
        localAudio.connect(destination);
      }
      
      // Create a MediaRecorder with the mixed audio
      const options = { mimeType: 'audio/webm' };
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
        setRecordedTime(prev => prev + 1);
      }, 1000);
      
      toast({
        title: "Recording Started",
        description: "Consultation recording has started.",
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
          
          toast({
            title: "Transcribing Audio",
            description: "Processing the recorded consultation...",
          });
          
          try {
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
          } catch (error) {
            console.error('Error transcribing audio:', error);
            toast({
              title: "Transcription Error",
              description: "Failed to transcribe the consultation recording.",
              variant: "destructive"
            });
          }
          
          resolve();
        };
        
        // Stop recording
        mediaRecorderRef.current.stop();
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
    const wsUrl = `${protocol}//${window.location.host}/ws/telemedicine`;
    
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
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'ice-candidate',
              target: targetUserId,
              sender: user?.id.toString(),
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
      
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          target: targetUserId,
          sender: user?.id.toString(),
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
            if (wsRef.current) {
              wsRef.current.send(JSON.stringify({
                type: 'ice-candidate',
                target: message.sender,
                sender: user?.id.toString(),
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
      
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          target: message.sender,
          sender: user?.id.toString(),
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
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.data));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };
  
  const handleICECandidate = async (message: any) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.data));
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
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
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{patient.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">{patient.name}</h3>
            <p className="text-xs text-muted-foreground">Video Consultation</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-sm bg-muted p-2 rounded-md">
            <span className="font-semibold">Patient Join URL:</span> {patientJoinUrl}
          </div>
          <div className="text-sm bg-muted p-2 rounded-md">
            <span className="font-semibold">Room ID:</span> {roomId}
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
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 flex flex-col ${chatOpen ? 'w-2/3' : 'w-full'}`}>
          <div className="relative flex-1 bg-muted">
            {/* Main remote video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Local video (pip) */}
            <div className="absolute bottom-4 right-4 w-1/4 max-w-[200px] rounded-lg overflow-hidden shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          
          <div className="p-2 bg-background">
            {transcription ? (
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Consultation Transcription</h4>
                <ScrollArea className="h-[200px]">
                  <p className="text-sm whitespace-pre-wrap">{transcription}</p>
                </ScrollArea>
                <div className="flex justify-end mt-4">
                  <Button onClick={createMedicalNote}>
                    <FileText className="h-4 w-4 mr-2" />
                    Create SOAP Note
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Recording Controls</h4>
                  {isRecording && (
                    <div className="flex items-center">
                      <span className="animate-pulse h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                      <span className="text-sm text-muted-foreground">
                        {Math.floor(recordedTime / 60)}:{(recordedTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {isRecording ? (
                    <Button variant="outline" onClick={stopRecording}>
                      <Square className="h-4 w-4 mr-2" />
                      Stop Recording
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={startRecording}>
                      <Circle className="h-4 w-4 mr-2 fill-red-500" />
                      Start Recording
                    </Button>
                  )}
                </div>
              </div>
            )}
            
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

export default function Telemedicine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [activeConsultation, setActiveConsultation] = useState<{
    roomId: string;
    patient: Patient;
  } | null>(null);
  
  // Mock waiting room data (would come from API in production)
  const waitingRoomPatients = [
    { id: 1, name: "John Doe", time: "2:30 PM", initials: "JD" },
    { id: 2, name: "Jane Smith", time: "3:00 PM", initials: "JS" },
    { id: 3, name: "Robert Johnson", time: "3:30 PM", initials: "RJ" },
  ];
  
  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
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
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">Scheduled for today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Online Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{waitingRoomPatients.length}</div>
                <p className="text-xs text-muted-foreground">Currently in waiting room</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8</div>
                <p className="text-xs text-muted-foreground">Sessions completed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Virtual Waiting Room</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {waitingRoomPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>{patient.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-sm text-muted-foreground">Scheduled: {patient.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon"
                        onClick={() => {
                          if (patients) {
                            const matchedPatient = patients.find(p => p.id === patient.id);
                            if (matchedPatient) {
                              handleStartConsultation(matchedPatient);
                            }
                          }
                        }}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <StartConsultationDialog 
            isOpen={showStartDialog}
            onClose={() => setShowStartDialog(false)}
            onStartConsultation={handleStartConsultation}
          />
        </div>
      )}
    </>
  );
}
