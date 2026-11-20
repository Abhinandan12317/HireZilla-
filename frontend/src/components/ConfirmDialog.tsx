import { AlertTriangle, X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  consequence: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-surface-card rounded-xl border border-border-subtle shadow-xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                danger
                  ? "bg-status-danger/12 text-status-danger"
                  : "bg-primary-fixed text-primary"
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2
              id="confirm-dialog-title"
              className="font-display font-bold text-lg text-on-surface"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-outline hover:text-on-surface p-1"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
          {consequence}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border-subtle bg-surface-card text-sm font-semibold text-on-surface hover:bg-paper-base transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 ${
              danger
                ? "bg-status-danger hover:bg-error"
                : "bg-primary-container hover:bg-primary"
            }`}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
