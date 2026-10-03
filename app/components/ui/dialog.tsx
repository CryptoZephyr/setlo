"use client";

import { X } from "lucide-react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { cn } from "./cn";

/** Bottom sheet on small screens, centred dialog on larger ones. Focus is trapped and restored. */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  children,
  className,
  isDismissable = true,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  isDismissable?: boolean;
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 sm:items-center sm:p-6"
    >
      <Modal className={cn("max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-surface shadow-pop sm:max-w-lg sm:rounded-xl", className)}>
        <Dialog className="outline-none">
          {({ close }) => (
            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <Heading slot="title" className="text-lg font-semibold">
                  {title}
                </Heading>
                {isDismissable && (
                  <button onClick={close} className="-m-2 flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted" aria-label="Close">
                    <X className="size-5" aria-hidden />
                  </button>
                )}
              </div>
              {children}
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
