import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { UserRole } from "../../../shared/types";
import { ToastProvider } from "../components/Toast";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../index.css";
import { replaceWith, routes } from "./navigation";

function getWorkspaceHome(role: UserRole | null): string {
  if (role === "recruiter") return routes.recruiterDashboard;
  if (role === "admin") return routes.admin();
  if (role === "student") return routes.studentDashboard;
  return routes.signup();
}

function ProtectedPageGate({
  allowedRoles,
  children,
}: {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!allowedRoles || loading) return;
    if (!user) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      replaceWith(routes.login(returnTo));
      return;
    }
    if (!user.role) {
      replaceWith(routes.signup());
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      replaceWith(getWorkspaceHome(user.role));
    }
  }, [allowedRoles, loading, user]);

  if (!allowedRoles) {
    return <>{children}</>;
  }

  if (loading || !user || !user.role || !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-paper-base flex items-center justify-center p-6">
        <div className="bg-surface-card border border-border-subtle rounded-2xl px-8 py-6 text-center shadow-xs">
          <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="font-display font-bold text-sm text-on-surface">
            Verifying HireZilla session...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function mountMpaPage(
  element: React.ReactNode,
  options: { allowedRoles?: UserRole[] } = {}
): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("Missing #root mount node.");
  }
  createRoot(rootEl).render(
    <AuthProvider>
      <ToastProvider>
        <ProtectedPageGate allowedRoles={options.allowedRoles}>{element}</ProtectedPageGate>
      </ToastProvider>
    </AuthProvider>
  );
}
