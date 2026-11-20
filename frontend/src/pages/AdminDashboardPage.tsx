import { useEffect, useState } from "react";
import { Mail, Shield, Users } from "lucide-react";
import type {
  AuditLogRecord,
  NotificationEmailRecord,
  ReportFlagRecord,
} from "../../../shared/types";
import { WorkspaceShell } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { apiRequest } from "../lib/api";
import { getQueryParam, setQueryParam } from "../lib/navigation";

export function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<string>(
    () => getQueryParam("tab") || "flags"
  );
  const { pushToast } = useToast();

  const [counts, setCounts] = useState({
    activeUsers: 0,
    companiesNotVerified: 0,
    openJobs: 0,
    openFlags: 0,
  });
  const [flags, setFlags] = useState<ReportFlagRecord[]>([]);
  const [records, setRecords] = useState<{
    users: Array<{ id: string; name: string; email: string; role: string | null; status: string }>;
    companies: Array<{
      id: string;
      name: string;
      status: string;
      verificationStatus: string;
      packageCode: string;
    }>;
    jobs: Array<{ id: string; title: string; companyName: string; status: string }>;
  } | null>(null);
  const [audits, setAudits] = useState<AuditLogRecord[]>([]);
  const [emails, setEmails] = useState<NotificationEmailRecord[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const loadAll = async () => {
    try {
      const [ov, fl, rec, aud, eml] = await Promise.all([
        apiRequest<{ counts: typeof counts }>("/api/admin/overview"),
        apiRequest<{ flags: ReportFlagRecord[] }>("/api/admin/flags"),
        apiRequest<typeof records>("/api/admin/records"),
        apiRequest<{ logs: AuditLogRecord[] }>("/api/admin/audit-logs"),
        apiRequest<{ notifications: NotificationEmailRecord[] }>("/api/admin/notifications"),
      ]);
      setCounts(ov.counts);
      setFlags(fl.flags);
      setRecords(rec);
      setAudits(aud.logs);
      setEmails(eml.notifications);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to load admin console.");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleResolveFlag = async (
    flagId: string,
    action: "dismiss" | "hide_job" | "suspend_company"
  ) => {
    const reason = reasons[flagId]?.trim() || "";
    if (reason.length < 5) {
      pushToast("error", "Provide an audit reason (min 5 chars) before moderating.");
      return;
    }
    try {
      await apiRequest(`/api/admin/flags/${flagId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      pushToast("success", `Moderation action (${action}) recorded.`);
      loadAll();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Action failed.");
    }
  };

  return (
    <WorkspaceShell
      title="Trust & Safety Admin Console"
      subtitle="Platform moderation, read-only audit logs, and development email outbox"
    >
      <div className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Users", val: counts.activeUsers },
            { label: "Companies (Not verified)", val: counts.companiesNotVerified },
            { label: "Open Jobs", val: counts.openJobs },
            { label: "Open Flags", val: counts.openFlags },
          ].map((k) => (
            <div
              key={k.label}
              className="bg-surface-card rounded-xl border border-border-subtle p-4 shadow-xs"
            >
              <p className="text-xs font-semibold text-on-surface-variant">{k.label}</p>
              <p className="font-display font-bold text-2xl text-on-surface mt-1 tabular-nums">
                {k.val}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "flags", label: `Reports & Flags (${flags.length})` },
            { id: "records", label: "Users, Companies & Jobs" },
            { id: "audit", label: `Audit Log (${audits.length})` },
            { id: "emails", label: `Dev Email Outbox (${emails.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id);
                if (t.id === "flags") {
                  window.history.replaceState({}, "", "/admin");
                } else {
                  setQueryParam("tab", t.id);
                }
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold ${
                activeTab === t.id
                  ? "bg-primary-container text-white"
                  : "bg-surface-card border border-border-subtle text-on-surface-variant"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "flags" && (
          <div className="space-y-3">
            {flags.map((f) => (
              <div
                key={f.id}
                className="bg-surface-card rounded-2xl border border-border-subtle p-5 space-y-3 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase text-primary">
                      {f.targetType} Flag
                    </span>
                    <h2 className="font-display font-bold text-base text-on-surface">
                      {f.targetTitle}
                    </h2>
                  </div>
                  <StatusBadge
                    variant={f.status === "open" ? "needs_review" : "qualified"}
                    customLabel={f.status}
                  />
                </div>
                <p className="text-xs text-on-surface-variant">
                  <strong>Reason:</strong> {f.reason} {f.details ? `— ${f.details}` : ""}
                </p>

                {f.status === "open" ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <input
                      value={reasons[f.id] || ""}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [f.id]: e.target.value }))
                      }
                      placeholder="Required moderation audit reason..."
                      className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-paper-base border border-border-subtle text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleResolveFlag(f.id, "dismiss")}
                      className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-bold"
                    >
                      Dismiss
                    </button>
                    {f.targetType === "job" && (
                      <button
                        type="button"
                        onClick={() => handleResolveFlag(f.id, "hide_job")}
                        className="px-3 py-1.5 rounded-lg bg-status-danger text-white text-xs font-bold"
                      >
                        Hide Job
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-outline">
                    Resolution: {f.resolutionNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "records" && records && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 space-y-3">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Companies (
                {records.companies.length})
              </h2>
              {records.companies.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-paper-base border border-border-subtle flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-on-surface">{c.name}</p>
                    <p className="text-outline">
                      {c.packageCode} · {c.verificationStatus}
                    </p>
                  </div>
                  <StatusBadge
                    variant={c.status === "active" ? "open" : "failed"}
                    customLabel={c.status}
                  />
                </div>
              ))}
            </div>

            <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 space-y-3">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Users ({records.users.length})
              </h2>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {records.users.map((u) => (
                  <div
                    key={u.id}
                    className="p-2.5 rounded-lg bg-paper-base border border-border-subtle flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-on-surface">{u.name}</p>
                      <p className="text-outline">
                        {u.email} · {u.role || "pending"}
                      </p>
                    </div>
                    <span className="capitalize font-semibold">{u.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper-base border-b border-border-subtle font-bold text-on-surface-variant">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {audits.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 px-4 font-mono tabular-nums">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      {a.actorRole} ({a.actorId})
                    </td>
                    <td className="py-2.5 px-4 font-bold text-primary">{a.action}</td>
                    <td className="py-2.5 px-4 font-mono">
                      {a.targetType}:{a.targetId}
                    </td>
                    <td className="py-2.5 px-4 text-on-surface-variant">
                      {a.reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "emails" && (
          <div className="space-y-3">
            {emails.length === 0 ? (
              <div className="bg-surface-card rounded-2xl border border-border-subtle p-8 text-center text-sm text-on-surface-variant">
                No emails dispatched yet during this session. Shortlist or invite a candidate to inspect HireZilla&apos;s dev email adapter output.
              </div>
            ) : (
              emails.map((e) => (
                <div
                  key={e.id}
                  className="bg-surface-card rounded-2xl border border-border-subtle p-5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-primary" /> {e.subject}
                    </span>
                    <StatusBadge
                      variant={e.status === "failed" ? "failed" : "qualified"}
                      customLabel={e.status}
                    />
                  </div>
                  <p className="text-xs text-outline">
                    To: {e.toName} ({e.toEmail}) · {new Date(e.createdAt).toLocaleString()}
                  </p>
                  <pre className="p-3 rounded-lg bg-paper-base border border-border-subtle text-xs whitespace-pre-wrap font-sans">
                    {e.bodyText}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
