import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { recordingService, generateSoapNotes } from "@/lib/recording-service";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mic, Upload, FileText as FileTextIcon, Save, Download, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import SignatureCanvas from 'react-signature-canvas';

// Define templates
const templates = [
  { id: "blank", name: "Blank Template", content: "" },
  { id: "soap", name: "SOAP Note", content: "## Subjective:\n\n## Objective:\n\n## Assessment:\n\n## Plan:\n" },
  { id: "progress", name: "Progress Note", content: "## Patient Progress\n\n## Current Status\n\n## Treatment Plan\n\n## Next Steps\n" },
  { id: "procedure", name: "Procedure Note", content: "## Procedure Type\n\n## Indications\n\n## Technique\n\n## Findings\n\n## Complications\n\n## Post-Procedure Care\n" },
];

// Define a schema for the quick note form
const quickNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["soap", "progress", "procedure"]),
  template: z.string().optional(),
});

type QuickNoteFormValues = z.infer<typeof quickNoteSchema>;

export default function QuickNotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [inputMethod, setInputMethod] = useState<string>("text");
  const [fileUploaded, setFileUploaded] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("blank");
  const [signature, setSignature] = useState<string | null>(null);
  const [editableContent, setEditableContent] = useState<string>("");
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<SignatureCanvas>(null);

  const form = useForm<QuickNoteFormValues>({
    resolver: zodResolver(quickNoteSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "soap",
      template: "blank",
    },
  });

  // Fetch quick notes from the API
  const { data: quickNotes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ["/api/quick-notes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/quick-notes");
      return await res.json();
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: QuickNoteFormValues) => {
      const response = await apiRequest("POST", "/api/quick-notes", {
        ...data,
        signature: signature
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Note saved successfully",
        description: "Your quick note has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quick-notes"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start recording logic
  const startRecording = async () => {
    try {
      await recordingService.startRecording();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      const timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
      setRecordingTimer(timer);
    } catch (error) {
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop recording logic
  const stopRecording = async () => {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    
    setIsRecording(false);
    await recordingService.stopRecording();
    const transcriptText = await recordingService.getTranscript();
    setTranscript(transcriptText);
    
    // Generate SOAP notes from transcript
    try {
      const content = await generateSoapNotes(transcriptText, {});
      setGeneratedContent(content);
      form.setValue("content", content);
      setEditableContent(content);
    } catch (error) {
      toast({
        title: "Error generating notes",
        description: "Could not generate notes from transcript. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setFileUploaded(true);
    
    try {
      const transcriptText = await recordingService.processAudioFile(file);
      setTranscript(transcriptText);
      
      // Generate SOAP notes from transcript
      const content = await generateSoapNotes(transcriptText, {});
      setGeneratedContent(content);
      form.setValue("content", content);
      setEditableContent(content);
    } catch (error) {
      toast({
        title: "Error processing file",
        description: "Could not process audio file. Please try a different file.",
        variant: "destructive",
      });
      setFileUploaded(false);
      setFileName("");
    }
  };

  // Handle text input directly
  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
  };

  // Generate notes from text input
  const generateNotesFromText = async () => {
    if (!transcript) {
      toast({
        title: "No text input",
        description: "Please enter some text before generating notes.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const content = await generateSoapNotes(transcript, {});
      setGeneratedContent(content);
      form.setValue("content", content);
      setEditableContent(content);
    } catch (error) {
      toast({
        title: "Error generating notes",
        description: "Could not generate notes from text. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEditableContent(template.content);
      form.setValue("content", template.content);
      form.setValue("template", templateId);
    }
  };

  // Format time for recording display (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  // Clear signature pad
  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setSignature(null);
    }
  };

  // Save signature
  const saveSignature = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setSignature(signatureRef.current.toDataURL());
      toast({
        title: "Signature captured",
        description: "Your signature has been saved with the note.",
      });
    } else {
      toast({
        title: "Empty signature",
        description: "Please draw a signature before saving.",
        variant: "destructive",
      });
    }
  };

  // Submit form
  const onSubmit = (data: QuickNoteFormValues) => {
    if (signature) {
      createNoteMutation.mutate({
        ...data,
        content: editableContent,
      });
    } else {
      toast({
        title: "Signature required",
        description: "Please add your signature before saving the note.",
        variant: "destructive",
      });
    }
  };

  // Reset form
  const resetForm = () => {
    form.reset({
      title: "",
      content: "",
      type: "soap",
      template: "blank",
    });
    setTranscript("");
    setGeneratedContent("");
    setEditableContent("");
    setFileUploaded(false);
    setFileName("");
    setInputMethod("text");
    clearSignature();
    setSignature(null);
    setShowPreview(false);
  };

  // Download note as PDF or text file
  const downloadNote = () => {
    const element = document.createElement("a");
    const file = new Blob([editableContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${form.getValues().title || "quick-note"}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [recordingTimer]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Quick Notes</h1>
          <p className="text-muted-foreground">Create notes without patient selection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Left Panel - Note Creation */}
        <div className="md:col-span-2 lg:col-span-3 space-y-4 md:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Quick Note</CardTitle>
              <CardDescription>
                Choose a template, record audio, upload a file, or type directly to create your note
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="create">Create Note</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                
                <TabsContent value="create" className="space-y-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter a title for your note" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select note type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="soap">SOAP Note</SelectItem>
                                <SelectItem value="progress">Progress Note</SelectItem>
                                <SelectItem value="procedure">Procedure Note</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <Label>Select Template</Label>
                        <Select
                          onValueChange={handleTemplateChange}
                          defaultValue={selectedTemplate}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Input Method</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            type="button"
                            variant={inputMethod === "record" ? "default" : "outline"}
                            onClick={() => setInputMethod("record")}
                            className="flex flex-col items-center py-4 h-auto"
                          >
                            <Mic className="mb-2 h-5 w-5" />
                            Record Audio
                          </Button>
                          <Button
                            type="button"
                            variant={inputMethod === "upload" ? "default" : "outline"}
                            onClick={() => setInputMethod("upload")}
                            className="flex flex-col items-center py-4 h-auto"
                          >
                            <Upload className="mb-2 h-5 w-5" />
                            Upload Audio
                          </Button>
                          <Button
                            type="button"
                            variant={inputMethod === "text" ? "default" : "outline"}
                            onClick={() => setInputMethod("text")}
                            className="flex flex-col items-center py-4 h-auto"
                          >
                            <FileTextIcon className="mb-2 h-5 w-5" />
                            Text Input
                          </Button>
                        </div>
                      </div>

                      {/* Recording UI */}
                      {inputMethod === "record" && (
                        <div className="p-4 border rounded-md space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`h-3 w-3 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-gray-300"}`}></div>
                              <span>{isRecording ? "Recording..." : "Not recording"}</span>
                            </div>
                            <div className="text-lg font-mono">{formatTime(recordingTime)}</div>
                          </div>
                          
                          <div className="flex space-x-2">
                            {!isRecording ? (
                              <Button 
                                type="button" 
                                onClick={startRecording} 
                                className="w-full"
                              >
                                Start Recording
                              </Button>
                            ) : (
                              <Button 
                                type="button" 
                                onClick={stopRecording} 
                                variant="destructive"
                                className="w-full"
                              >
                                Stop Recording
                              </Button>
                            )}
                          </div>
                          
                          {transcript && (
                            <div className="space-y-2">
                              <Label>Transcript</Label>
                              <div className="p-3 bg-muted rounded-md max-h-60 overflow-y-auto">
                                <p className="text-sm">{transcript}</p>
                              </div>
                              <Button 
                                type="button" 
                                onClick={generateNotesFromText}
                                variant="outline" 
                                className="w-full"
                              >
                                Generate Notes from Transcript
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Upload Audio UI */}
                      {inputMethod === "upload" && (
                        <div className="p-4 border rounded-md space-y-4">
                          <div className="flex flex-col items-center justify-center py-4">
                            <input 
                              type="file" 
                              accept="audio/*" 
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            {!fileUploaded ? (
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full"
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Audio File
                              </Button>
                            ) : (
                              <div className="space-y-2 w-full">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium truncate max-w-xs">{fileName}</span>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setFileUploaded(false);
                                      setFileName("");
                                    }}
                                  >
                                    Change
                                  </Button>
                                </div>
                                {transcript && (
                                  <div className="space-y-2">
                                    <Label>Transcript</Label>
                                    <div className="p-3 bg-muted rounded-md max-h-60 overflow-y-auto">
                                      <p className="text-sm">{transcript}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Text Input UI */}
                      {inputMethod === "text" && (
                        <div className="space-y-3">
                          <Label>Text Input</Label>
                          <Textarea 
                            placeholder="Paste or type your text here to generate structured notes..." 
                            rows={8}
                            value={transcript}
                            onChange={(e) => {
                              handleTextInputChange(e);
                              if (e.target.value) {
                                // Auto-generate notes when text is pasted
                                generateNotesFromText();
                              }
                            }}
                            onPaste={() => {
                              // Small delay to ensure pasted content is available
                              setTimeout(generateNotesFromText, 100);
                            }}
                            className="resize-none text-base p-4"
                          />
                          <Button 
                            type="button" 
                            onClick={generateNotesFromText}
                            variant="outline" 
                            className="w-full md:w-auto"
                          >
                            Generate Notes
                          </Button>
                        </div>
                      )}

                      {/* Editable Content */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Note Content</Label>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor="auto-generate" className="text-sm">Show Preview</Label>
                            <Switch 
                              id="show-preview" 
                              checked={showPreview}
                              onCheckedChange={setShowPreview}
                            />
                          </div>
                        </div>
                        <Textarea 
                          value={editableContent}
                          onChange={(e) => setEditableContent(e.target.value)}
                          className="font-mono min-h-[200px]"
                          placeholder="Note content will appear here..."
                        />
                      </div>

                      {/* Signature Pad */}
                      <div className="space-y-2">
                        <Label>Signature</Label>
                        <div className="border rounded-md p-2 bg-white">
                          <SignatureCanvas
                            ref={signatureRef}
                            canvasProps={{
                              className: "signature-canvas w-full h-[150px] border border-dashed border-gray-300 rounded-md"
                            }}
                            penColor="black"
                            dotSize={2}
                            throttle={16}
                            minWidth={1}
                            maxWidth={2.5}
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={clearSignature}
                            className="flex-1"
                          >
                            Clear
                          </Button>
                          <Button 
                            type="button" 
                            onClick={saveSignature}
                            className="flex-1"
                          >
                            Save Signature
                          </Button>
                        </div>
                        {signature && (
                          <div className="flex items-center space-x-2 text-sm text-green-600">
                            <Check className="h-4 w-4" />
                            <span>Signature captured</span>
                          </div>
                        )}
                      </div>

                      {/* Submit Buttons */}
                      <div className="flex space-x-2 pt-4">
                        <Button 
                          type="submit" 
                          className="flex-1"
                          disabled={createNoteMutation.isPending}
                        >
                          {createNoteMutation.isPending ? "Saving..." : "Save Note"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={downloadNote}
                          className="flex-1"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download as Text
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
                
                <TabsContent value="preview">
                  {editableContent ? (
                    <div className="p-6 border rounded-md bg-white min-h-[600px]">
                      <h2 className="text-xl font-bold mb-4">{form.getValues().title || "Untitled Note"}</h2>
                      <div className="prose max-w-none">
                        {editableContent.split("\n").map((line, i) => (
                          <p key={i} className="mb-2">{line}</p>
                        ))}
                      </div>
                      {signature && (
                        <div className="mt-8 border-t pt-4">
                          <p className="text-sm text-muted-foreground mb-2">Signed by:</p>
                          <img src={signature} alt="Signature" className="max-h-20" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-12 border rounded-md bg-muted">
                      <p className="text-muted-foreground">No content to preview</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Saved Notes List */}
        <div className="md:col-span-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Saved Quick Notes</CardTitle>
              <CardDescription>View and manage your saved notes</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingNotes ? (
                <div className="flex items-center justify-center p-12">
                  <div className="space-y-2 w-full">
                    <Progress value={45} className="w-full" />
                    <p className="text-center text-sm text-muted-foreground">Loading notes...</p>
                  </div>
                </div>
              ) : quickNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <FileTextIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                  <h3 className="text-lg font-medium">No saved notes</h3>
                  <p className="text-sm text-muted-foreground">Your saved quick notes will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quickNotes.map((note: any) => (
                    <Card key={note.id} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-lg">{note.title}</CardTitle>
                        <CardDescription>
                          {new Date(note.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-sm text-muted-foreground truncate">
                          {note.content.substring(0, 100)}...
                        </p>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between">
                        <Button variant="link" size="sm" className="px-0">
                          View Details
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}