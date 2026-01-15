import { useState, useCallback, useRef } from 'react';
import { Upload, X, Check, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import {
  useUploadImage,
  validateImageFile,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  type UploadProgress,
} from '../../hooks/useImages';

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
}

interface UploadStatus {
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface ImageUploadProps {
  /** Callback when upload completes successfully */
  onUploadComplete?: () => void;
  /** Maximum number of files that can be selected at once */
  maxFiles?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Image upload component with drag-and-drop support
 * Supports multiple file selection but uploads one at a time
 */
export function ImageUpload({
  onUploadComplete,
  maxFiles = 10,
  className,
}: ImageUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<Map<string, UploadStatus>>(
    new Map()
  );
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadImage();

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const errors: string[] = [];
      const validFiles: FileWithPreview[] = [];

      // Check total files limit
      const totalFiles = files.length + fileArray.length;
      if (totalFiles > maxFiles) {
        errors.push(`You can only upload up to ${maxFiles} images at a time.`);
        return;
      }

      fileArray.forEach((file) => {
        const validationError = validateImageFile(file);
        if (validationError) {
          errors.push(`${file.name}: ${validationError.message}`);
        } else {
          const id = generateId();
          validFiles.push({
            file,
            preview: URL.createObjectURL(file),
            id,
          });
        }
      });

      setValidationErrors(errors);
      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    },
    [files.length, maxFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        handleFiles(selectedFiles);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
    setUploadStatuses((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const uploadFile = useCallback(
    async (fileWithPreview: FileWithPreview) => {
      const { file, id } = fileWithPreview;

      setUploadStatuses((prev) => {
        const next = new Map(prev);
        next.set(id, { id, status: 'uploading', progress: 0 });
        return next;
      });

      try {
        await uploadMutation.mutateAsync({
          file,
          onProgress: (progress: UploadProgress) => {
            setUploadStatuses((prev) => {
              const next = new Map(prev);
              next.set(id, { id, status: 'uploading', progress: progress.percentage });
              return next;
            });
          },
        });

        setUploadStatuses((prev) => {
          const next = new Map(prev);
          next.set(id, { id, status: 'success', progress: 100 });
          return next;
        });

        // Remove successful upload after a delay
        setTimeout(() => {
          removeFile(id);
        }, 2000);

        onUploadComplete?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        setUploadStatuses((prev) => {
          const next = new Map(prev);
          next.set(id, { id, status: 'error', progress: 0, error: errorMessage });
          return next;
        });
      }
    },
    [uploadMutation, onUploadComplete, removeFile]
  );

  const uploadAll = useCallback(async () => {
    const pendingFiles = files.filter((f) => {
      const status = uploadStatuses.get(f.id);
      return !status || status.status === 'error';
    });

    // Upload one at a time
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
  }, [files, uploadStatuses, uploadFile]);

  const hasFilesToUpload = files.some((f) => {
    const status = uploadStatuses.get(f.id);
    return !status || status.status === 'error';
  });

  const isUploading = Array.from(uploadStatuses.values()).some(
    (s) => s.status === 'uploading'
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
          isDragging
            ? 'border-primary bg-primary-subtle'
            : 'border-border bg-card hover:border-primary/60 hover:bg-primary-subtle/50',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
        )}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload images. Click or drag and drop files here."
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FILE_TYPES.join(',')}
          multiple
          onChange={handleFileSelect}
          className="sr-only"
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
              isDragging ? 'bg-primary-muted' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'h-6 w-6 transition-colors',
                isDragging ? 'text-primary' : 'text-foreground-muted'
              )}
            />
          </div>

          <div>
            <p className="text-base font-medium text-foreground">
              {isDragging ? 'Drop your images here' : 'Drag and drop images here'}
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              or{' '}
              <span className="font-medium text-primary">browse files</span>
            </p>
          </div>

          <p className="text-xs text-foreground-subtle">
            JPEG, PNG, or WebP up to {formatFileSize(MAX_FILE_SIZE)}
          </p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-destructive-muted bg-destructive-subtle p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive-foreground-subtle">
                Some files could not be added
              </p>
              <ul className="mt-1 space-y-1 text-sm text-destructive-foreground-subtle/80">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setValidationErrors([])}
              className="text-destructive hover:text-destructive-foreground-subtle"
              aria-label="Dismiss errors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* File Preview Grid */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((fileWithPreview) => {
              const status = uploadStatuses.get(fileWithPreview.id);
              return (
                <FilePreviewCard
                  key={fileWithPreview.id}
                  file={fileWithPreview}
                  status={status}
                  onRemove={() => removeFile(fileWithPreview.id)}
                  formatFileSize={formatFileSize}
                />
              );
            })}
          </div>

          {/* Upload Button */}
          {hasFilesToUpload && (
            <div className="flex justify-end">
              <Button
                onClick={uploadAll}
                disabled={isUploading}
                isLoading={isUploading}
              >
                {isUploading ? 'Uploading...' : `Upload ${files.filter((f) => {
                  const status = uploadStatuses.get(f.id);
                  return !status || status.status === 'error';
                }).length} Image${files.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FilePreviewCardProps {
  file: FileWithPreview;
  status?: UploadStatus;
  onRemove: () => void;
  formatFileSize: (bytes: number) => string;
}

function FilePreviewCard({
  file,
  status,
  onRemove,
  formatFileSize,
}: FilePreviewCardProps) {
  const isUploading = status?.status === 'uploading';
  const isSuccess = status?.status === 'success';
  const isError = status?.status === 'error';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card transition-all',
        isSuccess && 'border-success ring-2 ring-success-subtle',
        isError && 'border-destructive ring-2 ring-destructive-subtle',
        !isSuccess && !isError && 'border-border-subtle'
      )}
    >
      {/* Image Preview */}
      <div className="relative aspect-square bg-muted">
        <img
          src={file.preview}
          alt={`Preview of ${file.file.name}`}
          className="h-full w-full object-cover"
        />

        {/* Upload Overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground-muted">
                {status.progress}%
              </span>
            </div>
          </div>
        )}

        {/* Success Overlay */}
        {isSuccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-success/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success">
              <Check className="h-6 w-6 text-success-foreground" />
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive">
              <AlertCircle className="h-6 w-6 text-destructive-foreground" />
            </div>
          </div>
        )}

        {/* Remove Button */}
        {!isUploading && !isSuccess && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-charcoal-800/60 text-white transition-colors hover:bg-charcoal-800/80"
            aria-label={`Remove ${file.file.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* File Info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium text-foreground">
          {file.file.name}
        </p>
        <p className="text-xs text-foreground-muted">
          {formatFileSize(file.file.size)}
        </p>
        {isError && status?.error && (
          <p className="mt-1 text-xs text-destructive">{status.error}</p>
        )}
      </div>

      {/* Progress Bar */}
      {isUploading && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Empty state component for use in the gallery
export function EmptyImagesState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-subtle">
        <ImageIcon className="h-10 w-10 text-primary" />
      </div>
      <h3 className="mt-6 text-xl font-semibold text-foreground">
        Start Protecting Your Images
      </h3>
      <p className="mt-2 text-primary font-medium">
        Take control of your digital presence
      </p>
      <p className="mt-3 max-w-md text-foreground-muted">
        Upload photos you want to protect. We'll continuously scan the web and alert
        you immediately if we find any unauthorized use of your images.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Check className="h-4 w-4 text-success" />
          <span>Secure & Private</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Check className="h-4 w-4 text-success" />
          <span>24/7 Monitoring</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Check className="h-4 w-4 text-success" />
          <span>Instant Alerts</span>
        </div>
      </div>
      <p className="mt-6 text-xs text-foreground-subtle">
        Use the upload area above to add your first image
      </p>
    </div>
  );
}
