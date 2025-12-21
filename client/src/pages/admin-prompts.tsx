import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  Edit2, 
  Eye, 
  EyeOff,
  FileText,
  Shield,
  AlertTriangle,
  Check,
  X,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";

interface GlobalPrompt {
  id: number;
  note_type: string;
  name: string;
  description: string;
  system_prompt: string;
  template_content: string;
  is_global: boolean;
  is_active: boolean;
  version: string;
  created_at: string;
  updated_at: string;
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  initial: "Initial Consultation",
  followup: "Follow-Up Visit",
  physical: "Annual Physical",
  procedure: "Procedure Note",
  psychiatric: "Psychiatric Evaluation",
  discharge: "Discharge Summary",
  reevaluation: "Re-Evaluation Note",
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  initial: "bg-blue-500",
  followup: "bg-green-500",
  physical: "bg-purple-500",
  procedure: "bg-orange-500",
  psychiatric: "bg-pink-500",
  discharge: "bg-red-500",
  reevaluation: "bg-cyan-500",
};

export default function AdminPrompts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPrompt, setSelectedPrompt] = useState<GlobalPrompt | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    note_type: "initial",
    system_prompt: "",
    template_content: "",
    is_active: true,
  });
  const [expandedPromptId, setExpandedPromptId] = useState<number | null>(null);

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be an administrator to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch global prompts
  const { data: globalPrompts = [], isLoading, refetch } = useQuery<GlobalPrompt[]>({
    queryKey: ['global-prompts'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/global-prompts');
      return response;
    },
  });

  // Toggle prompt active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      return apiRequest(`/api/admin/global-prompts/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-prompts'] });
      toast({
        title: "Status Updated",
        description: "Prompt status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update prompt status",
        variant: "destructive",
      });
    },
  });

  // Update prompt
  const updatePromptMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<GlobalPrompt> }) => {
      return apiRequest(`/api/admin/global-prompts/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-prompts'] });
      setIsEditDialogOpen(false);
      setSelectedPrompt(null);
      toast({
        title: "Prompt Updated",
        description: "The global prompt has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update prompt",
        variant: "destructive",
      });
    },
  });

  // Create new prompt
  const createPromptMutation = useMutation({
    mutationFn: async (data: typeof editFormData) => {
      return apiRequest('/api/admin/global-prompts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-prompts'] });
      setIsCreateDialogOpen(false);
      setEditFormData({
        name: "",
        description: "",
        note_type: "initial",
        system_prompt: "",
        template_content: "",
        is_active: true,
      });
      toast({
        title: "Prompt Created",
        description: "New global prompt has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create prompt",
        variant: "destructive",
      });
    },
  });

  // Delete prompt
  const deletePromptMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/global-prompts/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-prompts'] });
      toast({
        title: "Prompt Deleted",
        description: "The global prompt has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete prompt",
        variant: "destructive",
      });
    },
  });

  const handleEditPrompt = (prompt: GlobalPrompt) => {
    setSelectedPrompt(prompt);
    setEditFormData({
      name: prompt.name,
      description: prompt.description || "",
      note_type: prompt.note_type,
      system_prompt: prompt.system_prompt,
      template_content: prompt.template_content || "",
      is_active: prompt.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedPrompt) return;
    updatePromptMutation.mutate({
      id: selectedPrompt.id,
      updates: editFormData,
    });
  };

  const handleCreatePrompt = () => {
    createPromptMutation.mutate(editFormData);
  };

  const copyPromptToClipboard = (prompt: GlobalPrompt) => {
    navigator.clipboard.writeText(prompt.system_prompt);
    toast({
      title: "Copied",
      description: "System prompt copied to clipboard",
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Global Prompt Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage proprietary AIMS medical note prompts globally across all providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Global Prompt</DialogTitle>
                <DialogDescription>
                  Create a new proprietary prompt that will be available to all providers.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="Enter prompt name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Note Type</Label>
                    <Select
                      value={editFormData.note_type}
                      onValueChange={(value) => setEditFormData({ ...editFormData, note_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="Brief description of this prompt"
                  />
                </div>
                <div className="space-y-2">
                  <Label>System Prompt (AI Instructions)</Label>
                  <Textarea
                    value={editFormData.system_prompt}
                    onChange={(e) => setEditFormData({ ...editFormData, system_prompt: e.target.value })}
                    placeholder="Enter the AI system prompt..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template Content (Note Template)</Label>
                  <Textarea
                    value={editFormData.template_content}
                    onChange={(e) => setEditFormData({ ...editFormData, template_content: e.target.value })}
                    placeholder="Enter the note template..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editFormData.is_active}
                    onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_active: checked })}
                  />
                  <Label>Active (available to providers)</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePrompt} disabled={createPromptMutation.isPending}>
                  {createPromptMutation.isPending ? "Creating..." : "Create Prompt"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Prompts</p>
                <p className="text-2xl font-bold">{globalPrompts.length}</p>
              </div>
              <FileText className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {globalPrompts.filter(p => p.is_active).length}
                </p>
              </div>
              <Check className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-red-600">
                  {globalPrompts.filter(p => !p.is_active).length}
                </p>
              </div>
              <X className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Note Types</p>
                <p className="text-2xl font-bold">
                  {new Set(globalPrompts.map(p => p.note_type)).size}
                </p>
              </div>
              <Settings className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zero Hallucination Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Zero Hallucination Protocol Active</AlertTitle>
        <AlertDescription>
          All AIMS prompts include strict zero-hallucination instructions. The AI will only document
          information explicitly stated in the consultation transcript, using "[Not discussed]" for missing data.
        </AlertDescription>
      </Alert>

      {/* Prompts List */}
      <Card>
        <CardHeader>
          <CardTitle>Global Prompts Library</CardTitle>
          <CardDescription>
            Click on a prompt to expand and view/edit details. Toggle the switch to enable/disable prompts globally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading prompts...</div>
          ) : globalPrompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No global prompts configured. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {globalPrompts.map((prompt) => (
                <Card key={prompt.id} className={`transition-all ${!prompt.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${NOTE_TYPE_COLORS[prompt.note_type] || 'bg-gray-500'}`} />
                        <div>
                          <h3 className="font-semibold">{prompt.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              {NOTE_TYPE_LABELS[prompt.note_type] || prompt.note_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              v{prompt.version}
                            </span>
                            {prompt.description && (
                              <span className="text-sm text-muted-foreground">
                                — {prompt.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Active</Label>
                          <Switch
                            checked={prompt.is_active}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: prompt.id, is_active: checked })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
                        >
                          {expandedPromptId === prompt.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyPromptToClipboard(prompt)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPrompt(prompt)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete "${prompt.name}"? This cannot be undone.`)) {
                              deletePromptMutation.mutate(prompt.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Expanded View */}
                    {expandedPromptId === prompt.id && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <div>
                          <Label className="text-sm font-medium">System Prompt (AI Instructions)</Label>
                          <div className="mt-2 p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                            {prompt.system_prompt}
                          </div>
                        </div>
                        {prompt.template_content && (
                          <div>
                            <Label className="text-sm font-medium">Template Content</Label>
                            <div className="mt-2 p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                              {prompt.template_content}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Global Prompt</DialogTitle>
            <DialogDescription>
              Modify this prompt. Changes will affect all providers immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Note Type</Label>
                <Select
                  value={editFormData.note_type}
                  onValueChange={(value) => setEditFormData({ ...editFormData, note_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>System Prompt (AI Instructions)</Label>
              <Textarea
                value={editFormData.system_prompt}
                onChange={(e) => setEditFormData({ ...editFormData, system_prompt: e.target.value })}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Template Content (Note Template)</Label>
              <Textarea
                value={editFormData.template_content}
                onChange={(e) => setEditFormData({ ...editFormData, template_content: e.target.value })}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editFormData.is_active}
                onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_active: checked })}
              />
              <Label>Active (available to providers)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updatePromptMutation.isPending}>
              {updatePromptMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
