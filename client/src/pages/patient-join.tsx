import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff,
  X,
  MessageCircle,
  Send
} from "lucide-react";
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function PatientJoin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  
  // Video call state
  const [connected, setConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  const [messageText, setMessageText] = useState("");
  
  // References
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
  
  const handleJoin = () => {
    if (!roomId || !name) {
      toast({
        title: "Missing information",
        description: "Please enter your room ID and name",
        variant: "destructive"
      });
      return;
    }
    
    setJoined(true);
    initializeMedia();
  };
  
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
      
      // Initialize WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/telemedicine`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connection established');
        
        // Join the room
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'join',
            roomId,
            userId: `patient-${Date.now()}`,
            name,
            isDoctor: false
          }));
        }
      };
      
      wsRef.current.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'room-users':
            toast({
              title: "Connected to room",
              description: `You have joined the consultation room with ${message.users.length} participants`,
            });
            break;
            
          case 'user-joined':
            toast({
              title: "Participant joined",
              description: `${message.name} has joined the consultation`,
            });
            break;
            
          case 'user-left':
            toast({
              title: "Participant left",
              description: "A participant has left the consultation",
            });
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
                sender: `patient-${Date.now()}`,
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
          sender: `patient-${Date.now()}`,
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
        sender: `patient-${Date.now()}`,
        senderName: name,
        text: messageText,
        roomId
      };
      
      wsRef.current.send(JSON.stringify(message));
      
      // Add message to local state
      setMessages(prev => [...prev, {
        sender: name,
        text: messageText
      }]);
      
      // Clear input
      setMessageText("");
    }
  };
  
  const endCall = () => {
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
    
    setJoined(false);
    setLocation("/");
  };

  // Component cleanup on unmount
  useEffect(() => {
    return () => {
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
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {!joined ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join Medical Consultation</CardTitle>
            <CardDescription>
              Enter the room ID and your name to join your virtual consultation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="room-id" className="text-sm font-medium">
                  Room ID
                </label>
                <Input
                  id="room-id"
                  placeholder="Enter the room ID provided by your doctor"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Your Name
                </label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleJoin}>
              Join Consultation
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="w-full max-w-6xl h-[80vh] flex flex-col rounded-lg overflow-hidden border">
          <div className="flex justify-between items-center p-4 border-b">
            <div>
              <h3 className="font-medium">Medical Consultation</h3>
              <p className="text-xs text-muted-foreground">Connected as {name}</p>
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
              <Button variant="destructive" size="icon" onClick={endCall}>
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
              
              <div className="p-4 flex justify-center gap-2 bg-background">
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
                <Button variant="destructive" onClick={endCall}>
                  End Call
                </Button>
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
      )}
    </div>
  );
}