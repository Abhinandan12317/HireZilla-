import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser, Company, StudentPortfolio } from "../../../shared/types";
import { apiRequest, setStoredAuthToken } from "../lib/api";

interface AuthConfig {
  googleClientId: string | null;
  googleEnabled: boolean;
  demoAuthEnabled: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  company: Company | null;
  portfolio: StudentPortfolio | null;
  authConfig: AuthConfig;
  loading: boolean;
  refreshMe: () => Promise<void>;
  demoSignIn: (
    preset: "student_arjun" | "recruiter_priya" | "recruiter_nimbus" | "admin"
  ) => Promise<{ user: AuthUser; needsRoleSelection: boolean }>;
  emailSignUp: (
    email: string,
    name?: string
  ) => Promise<{ user: AuthUser; needsRoleSelection: boolean }>;
  googleSignIn: (idToken: string) => Promise<{ user: AuthUser; needsRoleSelection: boolean }>;
  selectRole: (role: "student" | "recruiter") => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [portfolio, setPortfolio] = useState<StudentPortfolio | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    googleClientId: null,
    googleEnabled: false,
    demoAuthEnabled: true,
  });
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const res = await apiRequest<{
        user: AuthUser | null;
        company: Company | null;
        portfolio: StudentPortfolio | null;
        authConfig: AuthConfig;
      }>("/api/auth/me");
      setUser(res.user);
      setCompany(res.company);
      setPortfolio(res.portfolio);
      setAuthConfig(res.authConfig);
    } catch {
      setUser(null);
      setCompany(null);
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const demoSignIn = async (
    preset: "student_arjun" | "recruiter_priya" | "recruiter_nimbus" | "admin"
  ) => {
    const res = await apiRequest<{
      user: AuthUser;
      token?: string;
      needsRoleSelection: boolean;
    }>("/api/auth/demo-signin", {
      method: "POST",
      body: JSON.stringify({ preset }),
    });
    if (res.token) setStoredAuthToken(res.token);
    await refreshMe();
    return res;
  };

  const emailSignUp = async (email: string, name?: string) => {
    const cleanEmail = email.trim();
    const cleanName = name?.trim();
    const body: { email: string; name?: string } = { email: cleanEmail };
    if (cleanName) {
      body.name = cleanName;
    }
    const res = await apiRequest<{
      user: AuthUser;
      token?: string;
      needsRoleSelection: boolean;
    }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.token) setStoredAuthToken(res.token);
    await refreshMe();
    return res;
  };

  const googleSignIn = async (idToken: string) => {
    const res = await apiRequest<{
      user: AuthUser;
      token?: string;
      needsRoleSelection: boolean;
    }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    if (res.token) setStoredAuthToken(res.token);
    await refreshMe();
    return res;
  };

  const selectRole = async (role: "student" | "recruiter") => {
    const res = await apiRequest<{ user: AuthUser; token?: string }>("/api/auth/role", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    if (res.token) setStoredAuthToken(res.token);
    await refreshMe();
    return res.user;
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      setStoredAuthToken(null);
      setUser(null);
      setCompany(null);
      setPortfolio(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        portfolio,
        authConfig,
        loading,
        refreshMe,
        demoSignIn,
        emailSignUp,
        googleSignIn,
        selectRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
