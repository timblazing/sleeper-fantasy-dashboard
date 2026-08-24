"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * A centered dialog on desktop, a bottom drawer on mobile.
 *
 * The same detail panel serves both, but a centered modal is unreachable with a thumb and a bottom
 * sheet wastes the width of a laptop — so the breakpoint picks the surface and the content stays
 * one component. Base UI's `Sheet` (`side="bottom"`) is the drawer here; both share the header
 * shape so the title and dismissal land in the same place either way.
 */
export function ResponsiveDialog({ open, onOpenChange, title, description, className, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={cn("max-h-[88svh] rounded-t-xl", className)}>
          <SheetHeader className="pb-0">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[85svh] max-w-2xl grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl", className)}>
        <DialogHeader className="pr-10">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="-mx-4 min-h-0 overflow-y-auto px-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
