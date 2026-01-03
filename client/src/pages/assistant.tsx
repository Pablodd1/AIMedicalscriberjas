import { useState, useRef, useEffect } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendIcon, PlusIcon, TrashIcon, BotIcon, UserIcon, RotateCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ChatSession, 
  Message, 
  sendMessage, 
  createNewSession, 
  generateSessionTitle 
} from '@/lib/openai-service';

export default function Assistant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    // Try to load sessions from localStorage
    const savedSessions = localStorage.getItem('aiAssistantSessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        return Array.isArray(parsed) ? parsed.map(session => ({
          ...session,
          createdAt: new Date(session.createdAt)
        })) : [createNewSession()];
      } catch (e) {
        return [createNewSession()];
      }
    }
    return [createNewSession()];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || '');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  
  // Save sessions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('aiAssistantSessions', JSON.stringify(sessions));
  }, [sessions]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  // Focus input field when active session changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleNewSession = () => {
    const newSession = createNewSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputValue('');
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (sessionId === activeSessionId && sessions.length > 1) {
      setActiveSessionId(sessions[0].id === sessionId ? sessions[1].id : sessions[0].id);
    } else if (sessions.length === 1) {
      // If deleting the only session, create a new one
      handleNewSession();
    }
  };

  const updateSessionMessages = (sessionId: string, messages: Message[]) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, messages } 
        : session
    ));
  };

  const updateSessionTitle = async (sessionId: string, firstUserMessage: string) => {
    try {
      const newTitle = await generateSessionTitle(firstUserMessage);
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, title: newTitle } 
          : session
      ));
    } catch (error) {
      console.error('Failed to update session title:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: Message = { role: 'user', content: inputValue.trim() };
    const updatedMessages = [...activeSession.messages, userMessage];
    
    // Update UI immediately with user message
    updateSessionMessages(activeSession.id, updatedMessages);
    setInputValue('');
    setIsLoading(true);
    
    // If this is the first user message, generate a title
    if (activeSession.messages.length === 1 && activeSession.messages[0].role === 'system') {
      updateSessionTitle(activeSession.id, userMessage.content);
    }
    
    try {
      // Send message to API and get response
      const assistantContent = await sendMessage(updatedMessages);
      const assistantMessage: Message = { role: 'assistant', content: assistantContent };
      
      // Update with assistant response
      updateSessionMessages(activeSession.id, [...updatedMessages, assistantMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive"
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left sidebar - Chat history */}
      <div className="w-64 bg-secondary/10 border-r border-border p-3 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chat History</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleNewSession}>
                  <PlusIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>New Conversation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <ScrollArea className="flex-grow">
          <div className="space-y-2">
            {sessions.map(session => (
              <div 
                key={session.id}
                className={`p-3 rounded-md cursor-pointer flex justify-between items-center group 
                  ${session.id === activeSessionId ? 'bg-secondary/30' : 'hover:bg-secondary/20'}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <div className="truncate flex-1">
                  <p className="font-medium truncate">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Logged in as {user?.username || 'User'}</p>
        </div>
      </div>
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Chat header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{activeSession?.title || 'New Conversation'}</h1>
            <p className="text-sm text-muted-foreground">
              AI Medical Assistant
            </p>
          </div>
        </div>
        
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {activeSession?.messages.filter(m => m.role !== 'system').map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg p-4 max-w-[80%] 
                  ${message.role === 'user' 
                    ? 'bg-primary text-primary-foreground ml-12' 
                    : 'bg-secondary/30 text-secondary-foreground mr-12'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {message.role === 'user' 
                      ? <UserIcon className="h-4 w-4" /> 
                      : <BotIcon className="h-4 w-4" />}
                    <span className="font-medium">
                      {message.role === 'user' ? 'You' : 'Doctor Helper Smart'}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.role !== 'user' && (
                    <div className="mt-2 pt-2 border-t border-secondary/20">
                      <span className="text-[10px] text-amber-600 bg-amber-50/50 px-1.5 py-0.5 rounded border border-amber-100/50">
                        AI Generated - Verify Accuracy
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary/30 rounded-lg p-4 flex items-center gap-2 text-secondary-foreground max-w-[80%] mr-12">
                  <RotateCw className="h-4 w-4 animate-spin" />
                  <span>AI is thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* Input area */}
        <div className="p-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                placeholder="Ask about medical conditions, treatments, or medical research..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={!inputValue.trim() || isLoading}>
                <SendIcon className="h-4 w-4 mr-2" />
                Send
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              AI assistant provides information to help with medical decisions but should not replace professional judgment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}