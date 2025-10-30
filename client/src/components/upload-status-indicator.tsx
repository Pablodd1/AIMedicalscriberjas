import { useUploadManager } from '@/contexts/upload-manager';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, XCircle, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function UploadStatusIndicator() {
  const { uploads, hasActiveUploads, cancelUpload, retryUpload } = useUploadManager();

  if (uploads.length === 0) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
          data-testid="button-upload-status"
        >
          <Upload className="h-4 w-4 mr-2" />
          Uploads
          {hasActiveUploads && (
            <Badge variant="default" className="ml-2" data-testid="badge-active-uploads">
              {uploads.filter(u => u.status === 'uploading' || u.status === 'pending').length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Recording Uploads</SheetTitle>
          <SheetDescription>
            Background uploads continue even after closing meetings
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="border rounded-lg p-4 space-y-2"
              data-testid={`upload-item-${upload.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm" data-testid={`upload-filename-${upload.id}`}>
                    {upload.filename}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(upload.blob.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {upload.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" data-testid={`status-uploading-${upload.id}`} />
                  )}
                  {upload.status === 'pending' && (
                    <Loader2 className="h-4 w-4 text-muted-foreground" data-testid={`status-pending-${upload.id}`} />
                  )}
                  {upload.status === 'completed' && (
                    <CheckCircle className="h-4 w-4 text-green-500" data-testid={`status-completed-${upload.id}`} />
                  )}
                  {upload.status === 'failed' && (
                    <XCircle className="h-4 w-4 text-red-500" data-testid={`status-failed-${upload.id}`} />
                  )}
                  {(upload.status === 'pending' || upload.status === 'failed') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancelUpload(upload.id)}
                      data-testid={`button-cancel-${upload.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {upload.status === 'uploading' && (
                <Progress value={50} className="h-2" data-testid={`progress-${upload.id}`} />
              )}

              {upload.status === 'failed' && (
                <div className="space-y-2">
                  <div className="text-xs text-red-500" data-testid={`error-message-${upload.id}`}>
                    {upload.error || 'Upload failed'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryUpload(upload.id)}
                    data-testid={`button-retry-${upload.id}`}
                  >
                    Retry Upload
                  </Button>
                </div>
              )}

              {upload.status === 'completed' && (
                <div className="text-xs text-green-600" data-testid={`completed-message-${upload.id}`}>
                  ✓ Uploaded to cloud storage
                </div>
              )}

              {upload.status === 'pending' && (
                <div className="text-xs text-muted-foreground" data-testid={`pending-message-${upload.id}`}>
                  Waiting to upload...
                </div>
              )}

              {upload.status === 'uploading' && (
                <div className="text-xs text-blue-600" data-testid={`uploading-message-${upload.id}`}>
                  Uploading to cloud storage...
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
