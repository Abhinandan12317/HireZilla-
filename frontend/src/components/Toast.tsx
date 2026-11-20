import React, { createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{
  pushToast: (kind: ToastKind, message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg border bg-surface-card text-sm ${
              t.kind === "success"
                ? "border-status-success/40 text-on-surface"
                : t.kind === "error"
                  ? "border-status-danger/40 text-on-surface"
                  : "border-primary/30 text-on-surface"
            }`}
          >
            {t.kind === "success" && (
              <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
            )}
            {t.kind === "error" && (
              <AlertCircle className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />
            )}
            {t.kind === "info" && (
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            )}
            <p className="flex-1 leading-snug font-medium">{t.message}</p>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-outline hover:text-on-surface p-0.5"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
