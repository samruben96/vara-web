import { Drawer } from 'vaul';
import { cn } from '@/lib/cn';

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Title for accessibility and optional visible header */
  title?: string;
  /** Optional description text */
  description?: string;
  /** Snap points as fractions of viewport height (0.5 = 50%) */
  snapPoints?: number[];
  /** Default snap point index */
  defaultSnapPoint?: number;
  /** Whether to show a visible header with title */
  showHeader?: boolean;
  /** Modal mode - disable interactions outside the sheet */
  modal?: boolean;
  /** Whether the sheet can be dismissed by swiping down (default: true) */
  dismissible?: boolean;
  /** Threshold to close as fraction of sheet height (0-1, default: 0.25) */
  closeThreshold?: number;
  /** Timeout in ms before scroll is locked (default: 200) */
  scrollLockTimeout?: number;
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  title,
  description,
  snapPoints,
  defaultSnapPoint,
  showHeader = false,
  modal = true,
  dismissible = true,
  closeThreshold = 0.25,
  scrollLockTimeout = 200,
}: BottomSheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={defaultSnapPoint !== undefined ? snapPoints?.[defaultSnapPoint] : undefined}
      modal={modal}
      dismissible={dismissible}
      closeThreshold={closeThreshold}
      scrollLockTimeout={scrollLockTimeout}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50',
            'flex max-h-[96vh] flex-col',
            'rounded-t-2xl bg-card',
            'focus:outline-none'
          )}
          aria-describedby={description ? 'sheet-description' : undefined}
        >
          {/* Drag Handle */}
          <div className="flex justify-center py-3">
            <div className="h-2 w-14 rounded-full bg-border" />
          </div>

          {/* Optional Header */}
          {showHeader && title && (
            <div className="border-b border-border px-4 pb-4">
              <Drawer.Title className="text-lg font-serif font-semibold text-foreground">
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description
                  id="sheet-description"
                  className="mt-1 text-sm text-foreground-subtle"
                >
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}

          {/* Hidden title for accessibility if no visible header */}
          {!showHeader && title && (
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
          )}
          {!showHeader && description && (
            <Drawer.Description id="sheet-description" className="sr-only">
              {description}
            </Drawer.Description>
          )}

          {/* Content with safe area padding */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
            <div className="pb-6">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Trigger component to open the bottom sheet */
export function BottomSheetTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  return <Drawer.Trigger asChild={asChild}>{children}</Drawer.Trigger>;
}

/** Close button component for the bottom sheet */
export function BottomSheetClose({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  return <Drawer.Close asChild={asChild}>{children}</Drawer.Close>;
}

export default BottomSheet;
