import {
  createContext,
  useContext,
  useEffect,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogContextValue = { onClose: () => void };
const DialogCtx = createContext<DialogContextValue>({ onClose: () => {} });

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <DialogCtx.Provider value={{ onClose: () => onOpenChange(false) }}>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        {children}
      </div>
    </DialogCtx.Provider>,
    document.body,
  );
}

export function DialogContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative z-50 my-4 w-full max-w-2xl space-y-6 rounded-[32px] border border-border bg-card/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:my-8 sm:p-8",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function DialogHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-1.5 text-center", className)}>{children}</div>;
}

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("font-display text-2xl font-semibold leading-tight text-foreground", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-base text-muted-foreground", className)}>{children}</p>
  );
}

export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 pt-2", className)}>
      {children}
    </div>
  );
}

export function DialogClose({
  children,
  className,
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  const { onClose } = useContext(DialogCtx);
  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={(e) => {
        onClick?.(e);
        onClose();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
