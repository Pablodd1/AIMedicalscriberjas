import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  Phone,
  PhoneOff,
  MessageCircle
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default function JoinConsultationPage() {
  const { roomId } = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Initialize local media stream
  useEffect(() => {
    if (!joined) return;
    
    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
        
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Setup websocket connection
        setupWebSocket();
        
      } catch (error) {
        console.error("Error accessing media devices:", error);
        toast({
          title: "Media Error",
          description: "Could not access your camera or microphone. Please check your permissions.",
          variant: "destructive"
        });
      }
    };
    
    setupMedia();
    
    return () => {
      // Cleanup media streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [joined, toast]);
  
  const setupWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/telemedicine`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connection established');
      console.log('Joining room with ID:', roomId);
      
      // Join the room
      if (wsRef.current && roomId) {
        wsRef.current.send(JSON.stringify({
          type: 'join',
          roomId: roomId,
          userId: `patient_${Date.now()}`,
          name: name,
          isDoctor: false
        }));
      } else {
        console.error('Cannot join room - missing room ID or WebSocket connection');
        toast({
          title: "Connection Error",
          description: "Unable to join consultation. Missing room ID.",
          variant: "destructive"
        });
      }
    };
    
    wsRef.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'room-users':
          // Find the doctor in the room
          const doctor = message.users.find((user: any) => user.isDoctor);
          if (doctor) {
            setDoctorName(doctor.name);
          }
          break;
          
        case 'user-joined':
          if (message.isDoctor) {
            setDoctorName(message.name);
            toast({
              title: "Doctor joined",
              description: `${message.name} has joined the consultation`,
            });
          }
          break;
          
        case 'offer':
          await handleOffer(message);
          break;
          
        case 'ice-candidate':
          await handleICECandidate(message);
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
        description: "There was an error connecting to the video session.",
        variant: "destructive"
      });
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed');
    };
  };
  
  const createPeerConnection = async (fromUserId?: string) => {
    try {
      const pc = new RTCPeerConnection(configuration);
      
      // Add local tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
          }
        });
      }
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && roomId) {
          console.log('Sending ICE candidate with room ID:', roomId);
          wsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate,
            roomId: roomId,
            sender: `patient_${Date.now()}`,
            target: fromUserId // Send to the doctor who sent the offer
          }));
        }
      };
      
      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setIsConnected(false);
          toast({
            title: "Connection Lost",
            description: "The video connection was lost. Please try rejoining.",
            variant: "destructive"
          });
        }
      };
      
      // Handle incoming tracks (remote stream)
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      peerConnectionRef.current = pc;
      return pc;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      toast({
        title: "Connection Error",
        description: "Failed to create connection. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };
  
  const handleOffer = async (message: any) => {
    try {
      console.log('Patient received offer message:', message);
      // Determine the sender ID (from or sender)
      const senderId = message.from || message.sender;
      if (!senderId) {
        console.error('Missing sender ID in offer message:', message);
        return;
      }
      
      const pc = await createPeerConnection(senderId);
      
      // Determine which format the offer is in
      const offerData = message.offer || message.data;
      if (!offerData) {
        console.error('Invalid offer format:', message);
        return;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(offerData));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      if (wsRef.current && roomId) {
        console.log('Patient sending answer with room ID:', roomId);
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          data: answer,
          roomId: roomId,
          sender: `patient_${Date.now()}`,
          target: senderId
        }));
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      toast({
        title: "Connection Error",
        description: "Failed to establish video connection. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleICECandidate = async (message: any) => {
    try {
      if (peerConnectionRef.current) {
        console.log('Patient received ICE candidate message:', message);
        // Check which format is being used
        const candidateData = message.candidate || message.data;
        if (candidateData) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidateData));
        } else {
          console.error('Invalid ICE candidate format:', message);
        }
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };
  
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = !audioEnabled;
        audioTracks[0].enabled = enabled;
        setAudioEnabled(enabled);
      }
    }
  };
  
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = !videoEnabled;
        videoTracks[0].enabled = enabled;
        setVideoEnabled(enabled);
      }
    }
  };
  
  const handleJoinSession = () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to join the consultation.",
        variant: "destructive"
      });
      return;
    }
    
    setJoined(true);
  };
  
  const handleEndCall = () => {
    // Clean up and exit
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Redirect to a thank you page or home
    window.location.href = '/consultation-complete';
  };
  
  if (!roomId) {
    return (
      <div className="container mx-auto p-4">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Invalid Consultation Link</CardTitle>
            <CardDescription>
              The consultation link appears to be invalid or expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Please contact your healthcare provider for a valid consultation link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!joined) {
    return (
      <div className="container mx-auto p-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Join Video Consultation</CardTitle>
            <CardDescription>
              Please enter your name to join the video consultation with your doctor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              
              <div className="pt-2">
                <Button 
                  className="w-full" 
                  onClick={handleJoinSession}
                  disabled={!name.trim()}
                >
                  Join Consultation
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              By joining, you agree to the video consultation terms and privacy policy.
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="relative flex-1 overflow-hidden">
        {/* Remote video (doctor) - fills the screen */}
        <video
          ref={remoteVideoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
        ></video>
        
        {/* Local video (patient) - picture-in-picture */}
        <div className="absolute bottom-4 right-4 w-40 h-[90px] md:w-60 md:h-[135px] rounded-lg overflow-hidden shadow-lg">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          ></video>
          
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-xl">{name.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
        
        {/* Connection status */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90">
            <div className="text-center space-y-4">
              <div className="inline-block animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
              <h2 className="text-xl font-semibold">Connecting to your doctor</h2>
              <p className="text-muted-foreground">Please wait while we connect you to {doctorName || 'your doctor'}...</p>
            </div>
          </div>
        )}
        
        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center p-4 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex space-x-4">
            <Button
              variant={audioEnabled ? "outline" : "destructive"}
              size="icon"
              className="bg-white/20 hover:bg-white/30 border-none rounded-full h-12 w-12"
              onClick={toggleAudio}
            >
              {audioEnabled ? <Mic /> : <MicOff />}
            </Button>
            
            <Button
              variant={videoEnabled ? "outline" : "destructive"}
              size="icon"
              className="bg-white/20 hover:bg-white/30 border-none rounded-full h-12 w-12"
              onClick={toggleVideo}
            >
              {videoEnabled ? <Camera /> : <CameraOff />}
            </Button>
            
            <Button
              variant="destructive"
              size="icon"
              className="rounded-full h-12 w-12"
              onClick={handleEndCall}
            >
              <PhoneOff />
            </Button>
          </div>
        </div>
        
        {/* Connected to info */}
        {isConnected && (
          <div className="absolute top-4 left-4 bg-black/30 text-white px-4 py-2 rounded-full">
            <p className="text-sm">Connected with: {doctorName || 'Doctor'}</p>
          </div>
        )}
      </div>
    </div>
  );
}