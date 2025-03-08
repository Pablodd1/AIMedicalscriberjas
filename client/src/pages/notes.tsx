import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Loader2, FileText, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Notes() {
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const { toast } = useToast();

  const handleStartRecording = () => {
    setIsRecording(true);
    toast({
      title: "Coming Soon",
      description: "Voice recording feature will be available soon",
    });
    setIsRecording(false);
  };

  const handleGenerateNotes = () => {
    setIsGenerating(true);
    toast({
      title: "Coming Soon",
      description: "AI note generation will be available soon",
    });
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Medical Notes</h1>
          <p className="text-muted-foreground">Generate and manage medical notes with AI assistance</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isRecording ? "destructive" : "outline"}
            onClick={handleStartRecording}
          >
            {isRecording ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Start Recording
              </>
            )}
          </Button>
          <Button onClick={handleGenerateNotes} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Notes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Note Editor</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Start typing or record your notes..."
              className="min-h-[300px]"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <Button className="mt-4 w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Notes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-32">
              AI-powered suggestions will appear here
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
