import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderOpen, File, Download, Trash2, Edit, FileText, FileImage, FilePlus, FileUp } from 'lucide-react';

interface PatientDocument {
  id: number;
  patientId: number;
  doctorId: number;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  title: string;
  description: string | null;
  tags: string[];
  uploadedAt: string;
}

interface DocumentManagerProps {
  patientId: number;
}

export function DocumentManager({ patientId }: DocumentManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<PatientDocument | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Fetch documents
  const { data: documents = [], isLoading, isError } = useQuery<PatientDocument[]>({
    queryKey: ['/api/patient-documents', patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patient-documents/${patientId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      return response.json();
    },
  });
  
  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/patient-documents/${patientId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload document');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patient-documents', patientId] });
      toast({
        title: 'Document uploaded',
        description: 'The document was uploaded successfully.',
      });
      resetForm();
      setUploadDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description: 'There was an error uploading the document. Please try again.',
        variant: 'destructive',
      });
      console.error('Upload error:', error);
    },
  });
  
  // Update document mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PatientDocument> }) => {
      const response = await fetch(`/api/patient-documents/${patientId}/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update document');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patient-documents', patientId] });
      toast({
        title: 'Document updated',
        description: 'The document details were updated successfully.',
      });
      resetForm();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: 'There was an error updating the document. Please try again.',
        variant: 'destructive',
      });
      console.error('Update error:', error);
    },
  });
  
  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/patient-documents/${patientId}/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patient-documents', patientId] });
      toast({
        title: 'Document deleted',
        description: 'The document was deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the document. Please try again.',
        variant: 'destructive',
      });
      console.error('Delete error:', error);
    },
  });
  
  // Handle upload form submission
  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please provide a title for the document.',
        variant: 'destructive',
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('title', title);
    
    if (description.trim()) {
      formData.append('description', description);
    }
    
    if (tags.trim()) {
      formData.append('tags', tags);
    }
    
    uploadMutation.mutate(formData);
  };
  
  // Handle edit form submission
  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentDocument) return;
    
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please provide a title for the document.',
        variant: 'destructive',
      });
      return;
    }
    
    const parsedTags = tags.trim() ? tags.split(',').map(tag => tag.trim()) : [];
    
    updateMutation.mutate({
      id: currentDocument.id,
      data: {
        title,
        description: description.trim() || null,
        tags: parsedTags,
      },
    });
  };
  
  // Handle document download
  const handleDownload = (doc: PatientDocument) => {
    window.open(`/api/patient-documents/${patientId}/download/${doc.id}`, '_blank');
  };
  
  // Reset form fields
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTags('');
    setSelectedFile(null);
    setCurrentDocument(null);
  };
  
  // Open edit dialog with document data
  const openEditDialog = (doc: PatientDocument) => {
    setCurrentDocument(doc);
    setTitle(doc.title);
    setDescription(doc.description || '');
    setTags(doc.tags.join(', '));
    setEditDialogOpen(true);
  };
  
  // Get file type icon
  const getFileIcon = (fileType: string) => {
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileType.toLowerCase())) {
      return <FileImage className="h-6 w-6" />;
    } else if (['pdf'].includes(fileType.toLowerCase())) {
      return <FileText className="h-6 w-6" />;
    } else if (['doc', 'docx', 'txt'].includes(fileType.toLowerCase())) {
      return <File className="h-6 w-6" />;
    } else {
      return <File className="h-6 w-6" />;
    }
  };
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Group documents by type
  const groupedDocuments = documents.reduce<Record<string, PatientDocument[]>>((acc: Record<string, PatientDocument[]>, doc: PatientDocument) => {
    const type = doc.fileType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {});
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Patient Documents</h2>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <FileUp className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center p-6">
          <p>Loading documents...</p>
        </div>
      ) : isError ? (
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-red-600">Error loading documents. Please try again.</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-md text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-gray-400" />
          <p className="mt-2 text-gray-600">No documents found for this patient</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setUploadDialogOpen(true)}
          >
            <FilePlus className="mr-2 h-4 w-4" />
            Add First Document
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Documents</TabsTrigger>
            {Object.keys(groupedDocuments).map(type => (
              <TabsTrigger key={type} value={type}>
                {type.toUpperCase()}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="all">
            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map(doc => (
                  <Card key={doc.id} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getFileIcon(doc.fileType)}
                          <div>
                            <CardTitle className="text-base">{doc.title}</CardTitle>
                            <p className="text-sm text-gray-500">{doc.originalFilename}</p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDownload(doc)}
                            title="Download document"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(doc)}
                            title="Edit details"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                title="Delete document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this document? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => deleteMutation.mutate(doc.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 pb-2">
                      {doc.description && (
                        <p className="text-sm text-gray-700 mb-2">{doc.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {doc.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between p-4 pt-2 bg-gray-50 text-xs text-gray-500">
                      <span>Type: {doc.fileType.toUpperCase()}</span>
                      <span>Size: {formatFileSize(doc.fileSize)}</span>
                      <span>Uploaded: {formatDate(doc.uploadedAt)}</span>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          {Object.entries(groupedDocuments).map(([type, docs]) => (
            <TabsContent key={type} value={type}>
              <ScrollArea className="h-[600px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {docs.map(doc => (
                    <Card key={doc.id} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {getFileIcon(doc.fileType)}
                            <div>
                              <CardTitle className="text-base">{doc.title}</CardTitle>
                              <p className="text-sm text-gray-500">{doc.originalFilename}</p>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDownload(doc)}
                              title="Download document"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openEditDialog(doc)}
                              title="Edit details"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete document"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this document? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate(doc.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 pb-2">
                        {doc.description && (
                          <p className="text-sm text-gray-700 mb-2">{doc.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between p-4 pt-2 bg-gray-50 text-xs text-gray-500">
                        <span>Type: {doc.fileType.toUpperCase()}</span>
                        <span>Size: {formatFileSize(doc.fileSize)}</span>
                        <span>Uploaded: {formatDate(doc.uploadedAt)}</span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      )}
      
      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document for this patient. Supported file types: PDF, Word, Excel, Images, Text files.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="file">Document File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter document title"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter document description"
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags (Optional, comma separated)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. lab report, blood work, imaging"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setUploadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Document Details</DialogTitle>
            <DialogDescription>
              Update the details of this document.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter document title"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter document description"
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-tags">Tags (Optional, comma separated)</Label>
                <Input
                  id="edit-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. lab report, blood work, imaging"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}