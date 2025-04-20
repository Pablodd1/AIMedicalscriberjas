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
  const [error, setError] = useState(""); // Added error state

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
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('Patient connecting to WebSocket at:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connection established');
      console.log('Joining room with ID:', roomId);

      // Join the room
      if (wsRef.current && roomId) {
        // Create a consistent patient ID for this session
        const patientId = sessionStorage.getItem('patientSessionId') || `patient_${Date.now()}`;
        
        // Store it in session storage for consistent use
        if (!sessionStorage.getItem('patientSessionId')) {
          sessionStorage.setItem('patientSessionId', patientId);
        }
        
        console.log('Patient joining room with ID:', roomId, 'using patientId:', patientId);
        wsRef.current.send(JSON.stringify({
          type: 'join',
          roomId: roomId,
          userId: patientId,
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
        case 'welcome':
          console.log('Patient received welcome message from server:', message.message);
          break;

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
      // Check if peer connection already exists
      if (peerConnectionRef.current) {
        console.log('Peer connection already exists, returning existing connection');
        return peerConnectionRef.current;
      }

      console.log('Creating new peer connection with doctor ID:', fromUserId);
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
      });
      
      // Use the same patient ID from session storage that we use for joining the room
      // Fall back to a new ID if needed and save it
      if (!sessionStorage.getItem('patientSessionId')) {
        sessionStorage.setItem('patientSessionId', `patient_${Date.now()}`);
      }
      const patientId = sessionStorage.getItem('patientSessionId');
      console.log('Patient using consistent session ID for WebRTC connection:', patientId);
      
      // Set up connection state monitoring
      pc.oniceconnectionstatechange = () => {
        console.log('Patient ICE connection state changed:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsConnected(true);
          toast({
            title: "Connected",
            description: `Connected with doctor ${doctorName || 'unknown'}`,
          });
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
          setIsConnected(false);
          toast({
            title: "Connection Lost",
            description: "The video connection was lost. Please try again.",
            variant: "destructive"
          });
        }
      };
      
      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('Patient connection state changed:', pc.connectionState);
      };
      
      // Monitor signaling state
      pc.onsignalingstatechange = () => {
        console.log('Patient signaling state changed:', pc.signalingState);
      };

      // Handle ICE candidates - use the fixed patientId
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && roomId) {
          console.log('Patient sending ICE candidate with room ID:', roomId);
          wsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            data: event.candidate,
            roomId: roomId,
            sender: patientId,
            target: fromUserId // Send to the doctor who sent the offer
          }));
        }
      };
      
      // Add local tracks to peer connection AFTER setting up event handlers
      if (localStreamRef.current) {
        console.log('Adding local tracks to peer connection');
        try {
          localStreamRef.current.getTracks().forEach(track => {
            console.log('Adding track to peer connection:', track.kind, track.label, track.enabled);
            if (localStreamRef.current) {
              pc.addTrack(track, localStreamRef.current);
            }
          });
        } catch (error) {
          console.error('Error adding tracks to peer connection:', error);
        }
      } else {
        console.warn('No local stream available when creating peer connection');
      }

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state changed:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('WebRTC connection established successfully');
          setIsConnected(true);
          setIsConnecting(false);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          console.error('WebRTC connection failed or disconnected:', pc.connectionState);
          setIsConnected(false);
          toast({
            title: "Connection Lost",
            description: "The video connection was lost. Please try rejoining.",
            variant: "destructive"
          });
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state changed:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          toast({
            title: "Connection Issue",
            description: "Network issue detected. The connection may be unstable.",
            variant: "destructive"
          });
        }
      };

      // Handle negotiation needed
      pc.onnegotiationneeded = async () => {
        console.log('Negotiation needed event fired');
      };

      // Handle incoming tracks (remote stream)
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind, event.track.label, event.track.readyState);
        
        // Make sure we have a valid remote video element
        if (!remoteVideoRef.current) {
          console.error('Remote video element not available');
          return;
        }
        
        // Some browsers don't create a new MediaStream automatically
        if (!remoteVideoRef.current.srcObject) {
          console.log('Creating new MediaStream for remote video');
          remoteVideoRef.current.srcObject = new MediaStream();
        }
        
        // Get the stream from the video element or create new one
        const stream = remoteVideoRef.current.srcObject as MediaStream;
        
        // Add the track to the stream if it's not already there
        const trackExists = stream.getTracks().some(t => t.id === event.track.id);
        if (!trackExists) {
          console.log('Adding track to remote stream:', event.track.kind, event.track.id);
          stream.addTrack(event.track);
        }
        
        // Log the current tracks in the stream
        console.log('Remote stream tracks:', stream.getTracks().map(t => `${t.kind}:${t.id}`).join(', '));
        
        // Update UI state
        setIsConnected(true);
        setIsConnecting(false);
        
        // Show a success toast
        toast({
          title: "Connected",
          description: `Video feed established with doctor ${doctorName || ''}`,
        });
      };

      peerConnectionRef.current = pc;
      return pc;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      setError("Failed to create connection"); // Set error state
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: "Failed to create connection. Please refresh and try again.",
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
        // Use a consistent patient ID stored during connection creation
        // Make sure patient ID exists in session storage
        if (!sessionStorage.getItem('patientSessionId')) {
          console.error('Patient ID missing from session storage - this should not happen');
          sessionStorage.setItem('patientSessionId', `patient_${Date.now()}`);
        }
        const patientId = sessionStorage.getItem('patientSessionId');
        
        console.log('Patient sending answer with room ID:', roomId, 'using patientId:', patientId);
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          data: answer,
          roomId: roomId,
          sender: patientId,
          target: senderId
        }));
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      setError("Failed to establish connection"); // Set error state
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: "Failed to establish video connection. Please refresh and try again.",
        variant: "destructive"
      });
    }
  };

  const handleICECandidate = async (message: any) => {
    try {
      if (!peerConnectionRef.current) {
        console.error('Patient cannot add ICE candidate - no peer connection exists');
        return;
      }
      
      // Check current connection state to make sure we're still connecting
      if (peerConnectionRef.current.connectionState === 'closed') {
        console.warn('Patient ignoring ICE candidate - connection is closed');
        return;
      }
      
      console.log('Patient received ICE candidate message from:', message.sender || message.from);
      
      // Wait for the peer connection to be in the right state to receive candidates
      if (peerConnectionRef.current.remoteDescription === null) {
        console.warn('Patient received ICE candidate before remote description was set. Waiting...');
        
        // Wait up to 5 seconds for the remote description to be set before trying to add the candidate
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5 seconds
        
        while (peerConnectionRef.current && peerConnectionRef.current.remoteDescription === null && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!peerConnectionRef.current || peerConnectionRef.current.remoteDescription === null) {
          console.error('Patient timed out waiting for remote description to be set');
          return;
        }
      }
      
      // Extract the candidate information from various possible message formats
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
      
      if (!candidate) {
        console.error('Invalid ICE candidate format:', message);
        return;
      }
      
      try {
        // Try to add the candidate directly
        console.log('Patient adding ICE candidate:', candidate);
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Patient successfully added ICE candidate');
      } catch (err) {
        console.error('Patient error adding ICE candidate:', err);
        
        // If direct addition fails, try with a standardized format
        if (typeof candidate === 'object' && candidate.candidate) {
          try {
            // Create a standardized candidate object with all required fields
            const standardCandidate = {
              candidate: candidate.candidate,
              sdpMLineIndex: candidate.sdpMLineIndex !== undefined ? candidate.sdpMLineIndex : 0,
              sdpMid: candidate.sdpMid || '0',
              usernameFragment: candidate.usernameFragment || undefined
            };
            
            console.log('Patient trying standardized candidate:', standardCandidate);
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(standardCandidate));
            console.log('Patient successfully added standardized ICE candidate');
          } catch (standardErr) {
            console.error('Patient failed to add standardized candidate:', standardErr);
            
            // Last resort - try with minimal required fields
            try {
              const minimalCandidate = {
                candidate: candidate.candidate,
                sdpMLineIndex: 0,
                sdpMid: '0'
              };
              
              console.log('Patient trying minimal candidate:', minimalCandidate);
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(minimalCandidate));
              console.log('Patient successfully added minimal ICE candidate');
            } catch (minimalErr) {
              console.error('Patient all attempts to add ICE candidate failed');
            }
          }
        }
      }
    } catch (error) {
      console.error('Unhandled error in ICE candidate handler:', error);
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

    // Redirect to the consultation complete page with room ID
    window.location.href = `/consultation-complete?roomId=${roomId}`;
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
            <p>Please contact your healthcare provider for a valid consultation link. The link should include a room ID.</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Example: <code className="bg-muted p-1 rounded">/join-consultation/room_12345</code>
            </p>
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
        {/* Remote video (doctor) - fills the screen without cropping */}
        <video
          ref={remoteVideoRef}
          className="w-full h-full object-contain bg-black"
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