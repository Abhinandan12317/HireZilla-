import React, { useEffect, useState } from "react";
import { ArrowRight, Briefcase, GraduationCap, Shield, Sparkles } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { PublicNavbar } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { getQueryParam, navigateTo, routes } from "../lib/navigation";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function AuthPage({ mode = "login" }: { mode?: "login" | "signup" }) {
  const { user, authConfig, demoSignIn, emailSignUp, googleSignIn, selectRole } = useAuth();
  const { pushToast } = useToast();
  const returnTo = getQueryParam("returnTo");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosenRole, setChosenRole] = useState<"student" | "recruiter" | null>(null);

  const routeAfterAuth = (role: string | null) => {
    if (returnTo && returnTo.startsWith("/")) {
      navigateTo(returnTo);
      return;
    }
    if (role === "recruiter") navigateTo(routes.recruiterDashboard);
    else if (role === "admin") navigateTo(routes.admin());
    else if (role === "student") navigateTo(routes.studentDashboard);
  };

  useEffect(() => {
    if (user && user.role) {
      routeAfterAuth(user.role);
    }
  }, [user]);

  // Load Google Identity Services button if GOOGLE_CLIENT_ID is configured
  useEffect(() => {
    if (!authConfig.googleEnabled || !authConfig.googleClientId) return;
    const container = document.getElementById("google-signin-btn");
    if (!container) return;

    const initGsi = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: authConfig.googleClientId!,
        callback: async (response) => {
          if (!response.credential) {
            pushToast("error", "We couldn't sign you in. Please try again.");
            return;
          }
          try {
            const res = await googleSignIn(response.credential);
            if (!res.needsRoleSelection) routeAfterAuth(res.user.role);
          } catch (err) {
            pushToast(
              "error",
              err instanceof Error ? err.message : "We couldn't sign you in. Please try again."
            );
          }
        },
      });
      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width: 340,
      });
    };

    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = initGsi;
    document.head.appendChild(script);
  }, [authConfig.googleEnabled, authConfig.googleClientId]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await emailSignUp(email, mode === "signup" ? name : undefined);
      if (!res.needsRoleSelection) {
        routeAfterAuth(res.user.role);
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDemoPreset = async (
    preset: "student_arjun" | "recruiter_priya" | "recruiter_nimbus" | "admin"
  ) => {
    setBusy(true);
    try {
      const res = await demoSignIn(preset);
      pushToast("success", `Signed in as ${res.user.name} (${res.user.role}).`);
      routeAfterAuth(res.user.role);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Demo sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRoleContinue = async () => {
    if (!chosenRole) return;
    setBusy(true);
    try {
      const updated = await selectRole(chosenRole);
      pushToast("success", `Welcome to HireZilla as a ${chosenRole}!`);
      if (chosenRole === "student") {
        navigateTo(returnTo && returnTo.startsWith("/") ? returnTo : routes.studentOnboarding());
      } else {
        navigateTo(routes.recruiterCompany);
      }
      void updated;
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setBusy(false);
    }
  };

  // New-user role choice screen (Admin never exposed here)
  if (user && user.role === null) {
    return (
      <div className="min-h-screen flex flex-col bg-paper-base">
        <PublicNavbar />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl bg-surface-card rounded-2xl border border-border-subtle shadow-lg p-8">
            <BrandMark />
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-on-surface mt-6">
              How will you use HireZilla?
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Signed in as <strong>{user.email}</strong>. Select your workspace role to continue.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => setChosenRole("student")}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  chosenRole === "student"
                    ? "border-primary bg-surface-container-low shadow-sm"
                    : "border-border-subtle hover:border-primary/40 bg-paper-base"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary-fixed text-primary flex items-center justify-center mb-3">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-lg text-on-surface">
                  Student / Candidate
                </p>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Build your verified skills &amp; projects portfolio, apply with PDF resumes, and complete AI text interviews.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setChosenRole("recruiter")}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  chosenRole === "recruiter"
                    ? "border-primary bg-surface-container-low shadow-sm"
                    : "border-border-subtle hover:border-primary/40 bg-paper-base"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center mb-3">
                  <Briefcase className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-lg text-on-surface">Recruiter</p>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Set up your company workspace, publish jobs with dynamic rubrics, review ATS evidence, and invite candidates.
                </p>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs text-outline">
                Role is locked after onboarding to preserve workspace isolation.
              </p>
              <button
                type="button"
                disabled={!chosenRole || busy}
                onClick={handleRoleContinue}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-container text-white font-bold text-sm hover:bg-primary transition-colors disabled:opacity-50"
              >
                <span>{busy ? "Saving..." : "Continue"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper-base">
      <PublicNavbar />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Primary Auth Panel */}
          <div className="lg:col-span-7 bg-surface-card rounded-2xl border border-border-subtle shadow-sm p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <BrandMark showTagline />
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-on-surface mt-6">
                {mode === "signup" ? "Create your HireZilla account" : "Sign in to HireZilla"}
              </h1>
              <p className="text-sm text-on-surface-variant mt-1">
                One account for candidate portfolios or company recruiting workspaces.
              </p>

              {authConfig.googleEnabled ? (
                <div className="mt-6">
                  <div id="google-signin-btn" />
                </div>
              ) : (
                <div className="mt-5 p-3 rounded-lg bg-surface-container-low border border-border-subtle text-xs text-on-surface-variant">
                  Google Sign-In activates automatically when <code className="font-mono">GOOGLE_CLIENT_ID</code> is configured. Use email sign-in or prototype demo accounts below.
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-xs font-bold text-on-surface mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ananya Verma"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-paper-base border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-bold text-on-surface mb-1"
                  >
                    Email Address <span className="text-status-danger">*</span>
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-paper-base border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-primary-container text-white font-bold text-sm hover:bg-primary transition-colors disabled:opacity-60"
                >
                  {busy
                    ? "Signing in..."
                    : mode === "signup"
                      ? "Continue with Email"
                      : "Sign in with Email"}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-xs text-on-surface-variant">
              <a href={routes.jobs} className="text-primary font-semibold hover:underline">
                Browse public jobs without signing in →
              </a>
              <span>
                {mode === "login" ? (
                  <>
                    New here?{" "}
                    <a href={routes.signup()} className="text-primary font-bold hover:underline">
                      Sign up
                    </a>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <a href={routes.login()} className="text-primary font-bold hover:underline">
                      Sign in
                    </a>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Prototype Demo Quick-Access Panel */}
          <div className="lg:col-span-5 bg-surface-card rounded-2xl border border-border-subtle shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="w-4 h-4" />
                <span>Prototype Demo Workspaces</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                Explore seeded HireZilla workspaces immediately. Seeded data is clearly marked as Demo.
              </p>

              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDemoPreset("student_arjun")}
                  className="w-full text-left p-3.5 rounded-xl bg-paper-base border border-border-subtle hover:border-primary/40 transition-all"
                >
                  <p className="text-sm font-bold text-on-surface">
                    Arjun Mehta · Student / Candidate
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Public portfolio `/p/arjun-mehta`, applications &amp; AI interview
                  </p>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDemoPreset("recruiter_priya")}
                  className="w-full text-left p-3.5 rounded-xl bg-paper-base border border-border-subtle hover:border-primary/40 transition-all"
                >
                  <p className="text-sm font-bold text-on-surface">
                    Priya Sharma · Recruiter (CloudScale Labs)
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    8 applicants, referral-first ranking, exact tie review &amp; AI report
                  </p>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDemoPreset("recruiter_nimbus")}
                  className="w-full text-left p-3.5 rounded-xl bg-paper-base border border-border-subtle hover:border-primary/40 transition-all"
                >
                  <p className="text-sm font-bold text-on-surface">
                    Aravind Rao · Recruiter (Nimbus FinTech)
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Separate tenant workspace verifying company isolation
                  </p>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDemoPreset("admin")}
                  className="w-full text-left p-3.5 rounded-xl bg-surface-container-low border border-border-subtle hover:border-primary/40 transition-all"
                >
                  <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span>Pre-provisioned Admin · Trust &amp; Safety</span>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Flags, moderation actions, audit log &amp; dev email outbox
                  </p>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-outline mt-4 leading-snug">
              Note: Admin role is never selectable via public signup and requires server allowlist provisioning.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
