import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  Mic, 
  MicOff, 
  HelpCircle, 
  Command, 
  Volume2, 
  Settings, 
  X,
  Plus,
  Trash2,
  Play,
  Pause,
  Square
} from "lucide-react";
import { useVoiceCommands } from "@/contexts/voice-command-context";
import { cn } from "@/lib/utils";

interface VoiceCommandControlProps {
  className?: string;
}

export function VoiceCommandControl({ className }: VoiceCommandControlProps) {
  const {
    isEnabled,
    isListening,
    lastCommand,
    recognizedCommand,
    confidence,
    supportedCommands,
    enableVoiceCommands,
    disableVoiceCommands,
    toggleVoiceCommands,
    addCustomCommand,
    removeCustomCommand
  } = useVoiceCommands();

  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newCommandPhrase, setNewCommandPhrase] = useState('');
  const [newCommandAction, setNewCommandAction] = useState('');
  const [newCommandDescription, setNewCommandDescription] = useState('');

  const handleAddCustomCommand = () => {
    if (newCommandPhrase && newCommandAction && newCommandDescription) {
      addCustomCommand({
        id: `custom_${Date.now()}`,
        phrase: [newCommandPhrase],
        action: newCommandAction,
        description: newCommandDescription,
        category: 'general'
      });
      
      // Clear form
      setNewCommandPhrase('');
      setNewCommandAction('');
      setNewCommandDescription('');
    }
  };

  const getCommandIcon = (commandId: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'start_recording': <Mic className="h-4 w-4" />,
      'stop_recording': <Square className="h-4 w-4" />,
      'pause_recording': <Pause className="h-4 w-4" />,
      'resume_recording': <Play className="h-4 w-4" />,
      'generate_notes': <Command className="h-4 w-4" />,
      'save_notes': <Play className="h-4 w-4" />,
      'preview_notes': <Volume2 className="h-4 w-4" />,
      'download_notes': <Play className="h-4 w-4" />,
      'help': <HelpCircle className="h-4 w-4" />,
      'toggle_voice': <Settings className="h-4 w-4" />
    };
    return iconMap[commandId] || <Command className="h-4 w-4" />;
  };

  const getStatusColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <>
      {/* Main Voice Control Button */}
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              {isEnabled ? <Mic className="h-5 w-5 text-green-600" /> : <MicOff className="h-5 w-5 text-gray-400" />}
              Voice Commands
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHelp(true)}
                className="h-8 w-8 p-0"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Switch
                checked={isEnabled}
                onCheckedChange={toggleVoiceCommands}
                className="ml-2"
              />
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status Display */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isListening ? "bg-red-500 animate-pulse" : isEnabled ? "bg-green-500" : "bg-gray-400"
              )} />
              <span className="text-sm font-medium">
                {isListening ? "Listening..." : isEnabled ? "Ready" : "Disabled"}
              </span>
            </div>
            {confidence > 0 && (
              <Badge 
                variant="outline" 
                className={cn("text-xs", getStatusColor(confidence))}
              >
                {Math.round(confidence * 100)}%
              </Badge>
            )}
          </div>

          {/* Last Command Display */}
          {lastCommand && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Last Command:</div>
              <div className="text-sm font-mono">"{lastCommand}"</div>
              {recognizedCommand && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ {recognizedCommand.description}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={enableVoiceCommands}
              disabled={isEnabled}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Mic className="h-4 w-4" />
              Enable Voice
            </Button>
            <Button
              onClick={disableVoiceCommands}
              disabled={!isEnabled}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <MicOff className="h-4 w-4" />
              Disable Voice
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Dialog */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Command className="h-5 w-5" />
                Voice Commands Help
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelp(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="p-0">
              <ScrollArea className="h-[500px] p-6">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Say any of the following phrases to control the application hands-free:
                  </div>
                  
                  {/* Commands by Category */}
                  {['recording', 'notes', 'navigation', 'telemedicine', 'intake', 'general'].map(category => {
                    const categoryCommands = supportedCommands.filter(cmd => cmd.category === category);
                    if (categoryCommands.length === 0) return null;
                    
                    return (
                      <div key={category}>
                        <div className="font-medium text-sm capitalize mb-2 text-primary">
                          {category} Commands:
                        </div>
                        <div className="grid gap-2">
                          {categoryCommands.map(command => (
                            <div key={command.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                              <div className="mt-0.5">
                                {getCommandIcon(command.id)}
                              </div>
                              <div className="flex-1">
                                <div className="font-mono text-sm mb-1">
                                  "{command.phrase[0]}"
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {command.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Separator className="mt-3" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Voice Settings
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Add Custom Command */}
              <div>
                <div className="font-medium text-sm mb-2">Add Custom Command:</div>
                <div className="space-y-2">
                  <Input
                    placeholder="Command phrase..."
                    value={newCommandPhrase}
                    onChange={(e) => setNewCommandPhrase(e.target.value)}
                    className="w-full"
                  />
                  <Input
                    placeholder="Action name..."
                    value={newCommandAction}
                    onChange={(e) => setNewCommandAction(e.target.value)}
                    className="w-full"
                  />
                  <Input
                    placeholder="Description..."
                    value={newCommandDescription}
                    onChange={(e) => setNewCommandDescription(e.target.value)}
                    className="w-full"
                  />
                  <Button
                    onClick={handleAddCustomCommand}
                    disabled={!newCommandPhrase || !newCommandAction || !newCommandDescription}
                    className="w-full"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Command
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Custom Commands List */}
              <div>
                <div className="font-medium text-sm mb-2">Custom Commands:</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {supportedCommands.filter(cmd => cmd.id.startsWith('custom_')).map(command => (
                    <div key={command.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex-1">
                        <div className="font-mono text-sm">{command.phrase[0]}</div>
                        <div className="text-xs text-muted-foreground">{command.description}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomCommand(command.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {supportedCommands.filter(cmd => cmd.id.startsWith('custom_')).length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No custom commands added yet
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}