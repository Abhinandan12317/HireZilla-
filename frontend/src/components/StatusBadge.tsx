import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  PauseCircle,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";

type Variant =
  | "qualified"
  | "not_qualified"
  | "needs_review"
  | "failed"
  | "processing"
  | "not_verified"
  | "open"
  | "draft"
  | "paused"
  | "closed"
  | "hidden"
  | "shortlisted"
  | "interview_invited"
  | "selected"
  | "not_selected"
  | "on_hold"
  | "referral"
  | "demo";

const STYLES: Record<
  Variant,
  { bg: string; text: string; label: string; Icon: typeof CheckCircle2 }
> = {
  qualified: {
    bg: "bg-status-success/12 border-status-success/30",
    text: "text-status-success",
    label: "Qualified",
    Icon: CheckCircle2,
  },
  not_qualified: {
    bg: "bg-surface-container-high border-outline-variant",
    text: "text-on-surface-variant",
    label: "Not qualified",
    Icon: XCircle,
  },
  needs_review: {
    bg: "bg-status-warning/15 border-status-warning/35",
    text: "text-status-warning",
    label: "Needs review",
    Icon: AlertTriangle,
  },
  failed: {
    bg: "bg-status-danger/12 border-status-danger/35",
    text: "text-status-danger",
    label: "Failed",
    Icon: XCircle,
  },
  processing: {
    bg: "bg-status-info/12 border-status-info/35",
    text: "text-status-info",
    label: "Processing",
    Icon: Clock,
  },
  not_verified: {
    bg: "bg-paper-base border-border-subtle",
    text: "text-on-surface-variant",
    label: "Not verified",
    Icon: ShieldAlert,
  },
  open: {
    bg: "bg-status-success/12 border-status-success/30",
    text: "text-status-success",
    label: "Open",
    Icon: CheckCircle2,
  },
  draft: {
    bg: "bg-surface-container-high border-outline-variant",
    text: "text-on-surface-variant",
    label: "Draft",
    Icon: Clock,
  },
  paused: {
    bg: "bg-status-warning/15 border-status-warning/35",
    text: "text-status-warning",
    label: "Paused",
    Icon: PauseCircle,
  },
  closed: {
    bg: "bg-surface-container-high border-outline-variant",
    text: "text-outline",
    label: "Closed",
    Icon: XCircle,
  },
  hidden: {
    bg: "bg-status-danger/12 border-status-danger/35",
    text: "text-status-danger",
    label: "Hidden by Admin",
    Icon: ShieldAlert,
  },
  shortlisted: {
    bg: "bg-primary-fixed border-primary/25",
    text: "text-primary",
    label: "Shortlisted",
    Icon: Sparkles,
  },
  interview_invited: {
    bg: "bg-tertiary-fixed border-tertiary/25",
    text: "text-on-tertiary-fixed",
    label: "Interview invited",
    Icon: Sparkles,
  },
  selected: {
    bg: "bg-status-success/15 border-status-success/35",
    text: "text-status-success",
    label: "Selected",
    Icon: Award,
  },
  not_selected: {
    bg: "bg-status-danger/12 border-status-danger/35",
    text: "text-status-danger",
    label: "Not selected",
    Icon: XCircle,
  },
  on_hold: {
    bg: "bg-status-warning/15 border-status-warning/35",
    text: "text-status-warning",
    label: "On hold",
    Icon: PauseCircle,
  },
  referral: {
    bg: "bg-primary-fixed border-primary/25",
    text: "text-primary",
    label: "Referred",
    Icon: Award,
  },
  demo: {
    bg: "bg-surface-container border-outline-variant",
    text: "text-on-surface-variant",
    label: "Demo listing",
    Icon: Sparkles,
  },
};

export function StatusBadge({
  variant,
  customLabel,
}: {
  variant: Variant;
  customLabel?: string;
}) {
  const cfg = STYLES[variant] ?? STYLES.processing;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{customLabel ?? cfg.label}</span>
    </span>
  );
}
