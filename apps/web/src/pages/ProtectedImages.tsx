import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Trash2, Search, Clock, CheckCircle, Archive, Loader2, Scan } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/cn';
import { Button } from '../components/ui/Button';
import { ImageUpload, EmptyImagesState } from '../components/ImageUpload';
import { ScanStatus } from '../components/ScanStatus';
import { useImages, useDeleteImage } from '../hooks/useImages';
import { useActiveScan, useLastCompletedScan, useTriggerScan, useTriggerImageScan } from '../hooks/useScans';
import { ApiRequestError } from '../lib/api';
import type { ProtectedImage } from '@vara/shared';

type ImageFilter = 'all' | 'scanned' | 'not_scanned' | 'archived';

export function ProtectedImages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get('filter') as ImageFilter) || 'all';
  const setFilter = (newFilter: ImageFilter) => {
    setSearchParams({ filter: newFilter });
  };
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [scanningImageId, setScanningImageId] = useState<string | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState(false);
  const [completedResult, setCompletedResult] = useState<{
    matchesFound: number;
    imagesScanned: number;
  } | null>(null);
  const [previousScanStatus, setPreviousScanStatus] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useImages({
    filter,
    limit: 50,
  });

  const deleteImage = useDeleteImage();
  const triggerScan = useTriggerScan();
  const triggerImageScan = useTriggerImageScan();
  const { data: activeScanData } = useActiveScan();
  const { refetch: refetchLastCompleted } = useLastCompletedScan();

  const images = data?.data || [];
  const hasImages = images.length > 0;

  // Get active scan from query data
  const activeScan = activeScanData?.data?.scans?.[0] || null;
  const isScanRunning = activeScan?.status === 'RUNNING' || activeScan?.status === 'PENDING';

  // Track scan completion and failure
  // Note: useActiveScan only returns RUNNING/PENDING scans. When a scan completes,
  // it disappears from results (status becomes null, not 'COMPLETED').
  // We detect completion as: previousStatus was RUNNING/PENDING -> now null.
  // Then we fetch the last completed scan to get results.
  useEffect(() => {
    const scanStatus = activeScan?.status ?? null;

    // Scan just completed: was active, now gone from active query
    if (
      (previousScanStatus === 'RUNNING' || previousScanStatus === 'PENDING') &&
      scanStatus === null
    ) {
      // Refetch the last completed scan to get results
      refetchLastCompleted().then((result) => {
        const lastScan = result.data?.data?.scans?.[0];
        const scanResult = lastScan?.result as { matchesFound?: number; imagesScanned?: number } | undefined;

        if (lastScan?.status === 'FAILED') {
          // Scan failed
          setScanningImageId(null);
          toast('Scan could not be completed. Please try again later.', {
            duration: 5000,
            style: {
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
            },
          });
          return;
        }

        // Scan completed successfully
        const matchesFound = scanResult?.matchesFound ?? 0;
        const imagesScanned = scanResult?.imagesScanned ?? images.length;

        setRecentlyCompleted(true);
        setCompletedResult({ matchesFound, imagesScanned });
        setScanningImageId(null);

        // Refetch images to update lastScanned status
        refetch();

        // Show completion toast
        if (matchesFound > 0) {
          toast(
            `Scan complete \u2014 ${matchesFound} potential match${matchesFound !== 1 ? 'es' : ''} found. Review your alerts.`,
            {
              duration: 5000,
              icon: '\u26A0\uFE0F',
              style: {
                background: '#fefce8',
                color: '#854d0e',
                border: '1px solid #fde68a',
              },
            }
          );
        } else {
          toast.success('Scan complete \u2014 your images are protected.', {
            duration: 5000,
            style: {
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
            },
          });
        }
      });
    }

    setPreviousScanStatus(scanStatus);
  }, [activeScan?.status, previousScanStatus, images.length, refetch, refetchLastCompleted]);

  // Handle scan all images
  const handleScanAll = useCallback(async () => {
    try {
      await triggerScan.mutateAsync({ type: 'IMAGE_SCAN' });
      toast.success('Scan started', {
        duration: 3000,
        icon: null,
        style: {
          background: '#f0fdf4',
          color: '#166534',
          border: '1px solid #bbf7d0',
        },
      });
    } catch (error) {
      // Handle 409 "scan already in progress" with helpful guidance
      if (error instanceof ApiRequestError && error.status === 409) {
        toast.error('A scan is already in progress. Check the status above.', {
          duration: 5000,
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          },
        });
      } else {
        toast.error(
          error instanceof Error ? error.message : 'Unable to start scan. Please try again.',
          {
            duration: 4000,
            style: {
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
            },
          }
        );
      }
    }
  }, [triggerScan]);

  // Handle scan single image
  const handleScanImage = useCallback(async (imageId: string) => {
    setScanningImageId(imageId);
    try {
      await triggerImageScan.mutateAsync(imageId);
      toast.success('Image scan started', {
        duration: 3000,
        icon: null,
        style: {
          background: '#f0fdf4',
          color: '#166534',
          border: '1px solid #bbf7d0',
        },
      });
    } catch (error) {
      setScanningImageId(null);
      // Handle 409 "scan already in progress" with helpful guidance
      if (error instanceof ApiRequestError && error.status === 409) {
        toast.error('A scan is already in progress. Check the status above.', {
          duration: 5000,
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          },
        });
      } else {
        toast.error(
          error instanceof Error ? error.message : 'Unable to start scan. Please try again.',
          {
            duration: 4000,
            style: {
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
            },
          }
        );
      }
    }
  }, [triggerImageScan]);

  // Dismiss scan status
  const handleDismissScanStatus = useCallback(() => {
    setRecentlyCompleted(false);
    setCompletedResult(null);
  }, []);

  const handleDelete = async (imageId: string) => {
    try {
      await deleteImage.mutateAsync(imageId);
      setImageToDelete(null);
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to delete image:', error);
    }
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimeAgo = (date: Date | string | null): string => {
    if (!date) return 'Never scanned';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Scanned today';
    if (diffDays === 1) return 'Scanned yesterday';
    if (diffDays < 7) return `Scanned ${diffDays} days ago`;
    if (diffDays < 30) return `Scanned ${Math.floor(diffDays / 7)} weeks ago`;
    return `Scanned on ${formatDate(date)}`;
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Page Header - mobile optimized */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-foreground">Protected Images</h1>
            <p className="mt-1 text-sm sm:text-base text-foreground-muted">
              Upload and manage photos you want monitored.
            </p>
          </div>
          {hasImages && (
            <Button
              onClick={handleScanAll}
              disabled={isScanRunning || triggerScan.isPending}
              isLoading={triggerScan.isPending || isScanRunning}
              className="self-start sm:self-auto"
            >
              {!isScanRunning && <Scan className="h-4 w-4" />}
              <span>{isScanRunning ? 'Scanning...' : 'Scan All Images'}</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 self-start">
          <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {images.length} image{images.length !== 1 ? 's' : ''} protected
          </span>
        </div>
      </div>

      {/* Scan Status Banner */}
      <ScanStatus
        activeScan={activeScan}
        recentlyCompleted={recentlyCompleted}
        completedResult={completedResult}
        onDismiss={handleDismissScanStatus}
      />

      {/* Upload Section */}
      <div className="card">
        <h2 className="text-base sm:text-lg font-serif font-semibold text-foreground">
          Upload New Images
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-foreground-muted">
          Add photos to protect. We'll scan the web for unauthorized use.
        </p>
        <div className="mt-3 sm:mt-4">
          <ImageUpload
            onUploadComplete={() => refetch()}
            maxFiles={10}
          />
        </div>
      </div>

      {/* Filter Tabs - horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar scroll-snap-x">
        <FilterTab
          label="All Images"
          isActive={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterTab
          label="Scanned"
          icon={<CheckCircle className="h-4 w-4" />}
          isActive={filter === 'scanned'}
          onClick={() => setFilter('scanned')}
        />
        <FilterTab
          label="Not Scanned"
          icon={<Clock className="h-4 w-4" />}
          isActive={filter === 'not_scanned'}
          onClick={() => setFilter('not_scanned')}
        />
        <FilterTab
          label="Archived"
          icon={<Archive className="h-4 w-4" />}
          isActive={filter === 'archived'}
          onClick={() => setFilter('archived')}
        />
      </div>

      {/* Images Gallery */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 sm:py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="py-12 sm:py-16 text-center">
            <p className="text-sm sm:text-base text-foreground-muted">
              Unable to load images. Please try again.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : !hasImages ? (
          <EmptyImagesState />
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onDelete={() => setImageToDelete(image.id)}
                onScan={() => handleScanImage(image.id)}
                isScanning={scanningImageId === image.id}
                isScanDisabled={isScanRunning || triggerImageScan.isPending}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {imageToDelete && (
        <DeleteConfirmationModal
          onConfirm={() => handleDelete(imageToDelete)}
          onCancel={() => setImageToDelete(null)}
          isDeleting={deleteImage.isPending}
        />
      )}
    </div>
  );
}

interface FilterTabProps {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

function FilterTab({ label, icon, isActive, onClick }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-4 py-2 text-sm font-medium transition-colors',
        'whitespace-nowrap min-h-touch touch-manipulation active-scale scroll-snap-start',
        isActive
          ? 'bg-primary-subtle text-primary'
          : 'text-foreground-muted hover:bg-muted hover:text-foreground active:bg-muted-hover'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface ImageCardProps {
  image: ProtectedImage;
  onDelete: () => void;
  onScan: () => void;
  isScanning: boolean;
  isScanDisabled: boolean;
  formatTimeAgo: (date: Date | string | null) => string;
}

function ImageCard({ image, onDelete, onScan, isScanning, isScanDisabled, formatTimeAgo }: ImageCardProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isArchived = image.status === 'ARCHIVED';
  const isScanned = image.lastScanned !== null;
  const imageUrl = image.signedUrl || image.storageUrl;

  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Unknown date';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Determine badge styling and content
  const getBadgeConfig = () => {
    if (isArchived) {
      return {
        className: 'bg-muted text-muted-foreground',
        icon: <Archive className="h-3 w-3" />,
        label: 'Archived',
      };
    }
    if (isScanned) {
      return {
        className: 'bg-success-subtle text-success-foreground-subtle',
        icon: <Shield className="h-3 w-3" />,
        label: 'Protected',
      };
    }
    return {
      className: 'bg-warning-subtle text-warning-foreground-subtle',
      icon: <Clock className="h-3 w-3" />,
      label: 'Pending',
    };
  };

  const badge = getBadgeConfig();

  // Toggle actions on tap for mobile
  const handleImageClick = () => {
    setShowActions(!showActions);
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-card transition-all',
        'hover:shadow-md active:scale-[0.98] touch-manipulation',
        isArchived ? 'border-border/40 opacity-75' : 'border-border/40'
      )}
    >
      {/* Image */}
      <div
        className="relative aspect-square bg-muted"
        onClick={handleImageClick}
      >
        <img
          src={hasImageError ? '/placeholder-image.svg' : imageUrl}
          alt={`Protected image uploaded ${formatDate(image.uploadedAt)}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setHasImageError(true)}
        />

        {/* Status Badge - smaller on mobile */}
        <div
          className={cn(
            'absolute left-1.5 top-1.5 sm:left-2 sm:top-2',
            'flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium',
            badge.className
          )}
        >
          {badge.icon}
          <span className="hidden xs:inline">{badge.label}</span>
        </div>

        {/* Hover/Tap Actions */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center gap-2 bg-foreground/60 transition-opacity',
            'opacity-0 group-hover:opacity-100',
            showActions && 'opacity-100'
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(imageUrl, '_blank');
            }}
            className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-card text-foreground transition-colors hover:bg-card-hover active:bg-muted"
            aria-label="View full size"
          >
            <Search className="h-5 w-5" />
          </button>
          {!isArchived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isScanDisabled) {
                  onScan();
                }
              }}
              disabled={isScanDisabled}
              className={cn(
                'flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-card transition-colors',
                isScanDisabled
                  ? 'text-foreground-subtle cursor-not-allowed'
                  : 'text-primary hover:bg-primary-subtle active:bg-primary-muted'
              )}
              aria-label={isScanning ? 'Scanning image...' : 'Scan this image'}
            >
              {isScanning ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Scan className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-card text-destructive transition-colors hover:bg-destructive-subtle active:bg-destructive-muted"
            aria-label="Delete image"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image Info - compact on mobile */}
      <div className="p-2 sm:p-3">
        <div className="flex items-center gap-1 text-xs sm:text-sm text-foreground-subtle">
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="truncate">{formatTimeAgo(image.lastScanned)}</span>
        </div>
        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-foreground-subtle truncate">
          Uploaded {new Date(image.uploadedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

interface DeleteConfirmationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmationModal({
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmationModalProps) {
  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel, isDeleting]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/50 p-0 sm:p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        className={cn(
          'w-full sm:max-w-md bg-card shadow-xl',
          // Mobile: bottom sheet style
          'rounded-t-2xl sm:rounded-xl',
          'p-4 pb-safe sm:p-6',
          'animate-slide-in-bottom sm:animate-scale-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pb-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        <h2
          id="delete-dialog-title"
          className="text-base sm:text-lg font-serif font-semibold text-foreground"
        >
          Remove Protected Image?
        </h2>
        <p className="mt-2 text-sm sm:text-base text-foreground-muted">
          This image will no longer be monitored. This action cannot be undone.
        </p>
        <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            isLoading={isDeleting}
            className="w-full sm:w-auto"
          >
            Remove Image
          </Button>
        </div>
      </div>
    </div>
  );
}

// Default export for lazy loading
export default ProtectedImages;
