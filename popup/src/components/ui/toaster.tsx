import { useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyError = async (id: string, title: React.ReactNode, description: React.ReactNode) => {
    const textToCopy = `${title || ''}${title && description ? ': ' : ''}${description || ''}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isError = variant === 'destructive';
        const isCopied = copiedId === id;

        return (
          <Toast
            key={id}
            duration={isError ? 5000 : 2000}
            variant={variant}
            {...props}
            onClick={isError ? () => handleCopyError(id, title, description) : undefined}
            className={isError ? 'cursor-pointer' : undefined}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {isError && (
                <div className="text-xs opacity-70 mt-1">
                  {isCopied ? 'Copied!' : 'Click to copy'}
                </div>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
