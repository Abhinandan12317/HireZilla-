import React, { useState } from "react";
import {
  Briefcase,
  Building2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Search,
  Shield,
  Sparkles,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { BRAND } from "../../../shared/constants";
import { useAuth } from "../context/AuthContext";
import { isActivePath, navigateTo, routes } from "../lib/navigation";
import { BrandMark } from "./BrandMark";

export function PublicNavbar() {
  const { user, logout } = useAuth();

  const dashboardPath =
    user?.role === "recruiter"
      ? "/recruiter/dashboard"
      : user?.role === "admin"
        ? "/admin"
        : user?.role === "student"
          ? "/student/dashboard"
          : "/login";

  return (
    <header className="sticky top-0 z-50 bg-surface-card/92 backdrop-blur-md border-b border-border-subtle">
      <div className="h-[72px] max-w-[1320px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
        <a href={routes.home} className="shrink-0">
          <BrandMark showTagline />
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-on-surface-variant">
          <a
            href={routes.jobs}
            className={
              isActivePath("/jobs")
                ? "text-primary font-bold"
                : "hover:text-on-surface transition-colors"
            }
          >
            Browse Jobs
          </a>
          <a href="/#how-it-works" className="hover:text-on-surface transition-colors">
            How it works
          </a>
          <a
            href={routes.packages}
            className={
              isActivePath("/packages")
                ? "text-primary font-bold"
                : "hover:text-on-surface transition-colors"
            }
          >
            Packages
          </a>
          <a
            href={routes.portfolio("arjun-mehta")}
            className="hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <span>Sample Portfolio</span>
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <a
                href={dashboardPath}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition-colors shadow-xs"
              >
                <span>Open Workspace</span>
              </a>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigateTo(routes.home);
                }}
                className="p-2 rounded-lg border border-border-subtle text-on-surface-variant hover:text-on-surface hover:bg-paper-base transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <a
                href={routes.login()}
                className="px-3 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Sign in
              </a>
              <a
                href={routes.signup()}
                className="inline-flex items-center justify-center bg-primary-container text-on-primary text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary transition-all shadow-xs"
              >
                Get started
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-on-surface text-surface-card border-t border-border-subtle mt-auto">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-8 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-xl tracking-tight text-white">
              {BRAND.name}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed">
              {BRAND.tagline}
            </span>
          </div>
          <p className="text-sm text-white/70 mt-2 max-w-md">
            {BRAND.heroTagline} Built with transparent 7-category rubric scoring and human-in-the-loop hiring decisions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm text-white/80">
          <a href={routes.jobs} className="hover:text-white transition-colors">
            Browse Jobs
          </a>
          <a href={routes.packages} className="hover:text-white transition-colors">
            Packages
          </a>
          <a href={routes.portfolio("arjun-mehta")} className="hover:text-white transition-colors">
            Portfolio Demo
          </a>
          <a href={routes.login()} className="hover:text-white transition-colors">
            Sign in
          </a>
        </div>
      </div>
    </footer>
  );
}

type NavItem = { to: string; label: string; Icon: typeof LayoutGrid };

export function WorkspaceShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { user, company, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const studentNav: NavItem[] = [
    { to: "/student/dashboard", label: "Overview", Icon: LayoutGrid },
    { to: "/jobs", label: "Find Jobs", Icon: Search },
    { to: "/student/applications", label: "My Applications", Icon: FileText },
    { to: "/student/onboarding", label: "My Portfolio", Icon: FolderKanban },
  ];

  const recruiterNav: NavItem[] = [
    { to: "/recruiter/dashboard", label: "Overview", Icon: LayoutGrid },
    { to: "/recruiter/company", label: "Company Profile", Icon: Building2 },
    { to: "/recruiter/jobs", label: "Jobs", Icon: Briefcase },
    { to: "/recruiter/package", label: "Package", Icon: Package },
  ];

  const adminNav: NavItem[] = [
    { to: "/admin", label: "Overview & Flags", Icon: Shield },
    { to: "/admin?tab=records", label: "Users & Companies", Icon: Users },
    { to: "/admin?tab=audit", label: "Audit Log", Icon: ClipboardCheck },
    { to: "/admin?tab=emails", label: "Dev Email Outbox", Icon: Sparkles },
  ];

  const navItems =
    user?.role === "recruiter"
      ? recruiterNav
      : user?.role === "admin"
        ? adminNav
        : studentNav;

  const sidebarBody = (
    <div className="flex flex-col h-full justify-between py-6">
      <div className="flex flex-col gap-6">
        <div className="px-5 flex items-center justify-between">
          <a href={routes.home}>
            <BrandMark />
          </a>
          <button
            type="button"
            className="lg:hidden p-1 text-outline hover:text-on-surface"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {user?.role === "recruiter" && (
          <div className="mx-4 p-3 bg-paper-base rounded-xl border border-border-subtle">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className="text-on-surface">Hatchling · Free</span>
              <span className="text-primary tabular-nums">20 / job cap</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1 truncate">
              {company ? `${company.name} · Not verified` : "Complete Company Profile"}
            </p>
          </div>
        )}

        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.Icon;
            const active = isActivePath(item.to, item.to === "/admin");
            return (
              <a
                key={item.to}
                href={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? "bg-surface-container text-primary font-bold border-l-4 border-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <div className="px-4 flex flex-col gap-3">
        <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{BRAND.mascotIntro}</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 leading-snug">
            {user?.role === "recruiter"
              ? "Zilo surfaces evidence; human recruiters make every decision."
              : "Your skills and projects power your HireZilla portfolio."}
          </p>
        </div>

        <div className="flex items-center justify-between px-2 py-2 border-t border-border-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle className="w-6 h-6 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">{user?.name}</p>
              <p className="text-[11px] text-outline capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigateTo(routes.home);
            }}
            className="p-1.5 rounded-lg text-outline hover:text-status-danger hover:bg-status-danger/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper-base flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-[248px] bg-surface-card border-r border-border-subtle z-40">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-on-surface/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-[260px] max-w-[85vw] bg-surface-card h-full z-10 border-r border-border-subtle">
            {sidebarBody}
          </aside>
        </div>
      )}

      <div className="flex-1 lg:pl-[248px] flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-[68px] bg-surface-card/90 backdrop-blur-md border-b border-border-subtle px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-border-subtle text-on-surface"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg text-on-surface truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {user?.role === "recruiter" && (
              <a
                href={routes.recruiterJobNew}
                className="px-3.5 py-2 rounded-lg bg-primary-container text-on-primary text-xs sm:text-sm font-semibold hover:bg-primary transition-colors shadow-xs whitespace-nowrap"
              >
                + Create Job
              </a>
            )}
            {user?.role === "student" && (
              <a
                href={routes.jobs}
                className="px-3.5 py-2 rounded-lg bg-primary-container text-on-primary text-xs sm:text-sm font-semibold hover:bg-primary transition-colors shadow-xs whitespace-nowrap"
              >
                Browse Jobs
              </a>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

