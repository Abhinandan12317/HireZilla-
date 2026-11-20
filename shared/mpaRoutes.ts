/**
 * Shared Multi-Page Application (MPA) route resolver.
 * Maps clean HireZilla URLs to dedicated static HTML documents (non-SPA).
 * Used by both standalone frontend/server.ts and root server.ts.
 */
export function resolveMpaHtmlPath(rawPathname: string): string | null {
  const pathname = (rawPathname || "/").split("?")[0].replace(/\/+$/, "") || "/";

  // Skip Vite internals, static assets, and API paths
  if (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/src/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/@") ||
    pathname.startsWith("/node_modules/") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return null;
  }

  if (pathname === "/") return "/index.html";
  if (pathname === "/jobs") return "/jobs/index.html";
  if (pathname === "/packages") return "/packages/index.html";
  if (pathname === "/login") return "/login/index.html";
  if (pathname === "/signup") return "/signup/index.html";
  if (pathname === "/admin") return "/admin/index.html";

  // Student workspace
  if (pathname === "/student/dashboard") return "/student/dashboard/index.html";
  if (pathname === "/student/onboarding") return "/student/onboarding/index.html";
  if (pathname === "/student/applications") return "/student/applications/index.html";
  if (pathname === "/student/applications/detail") return "/student/applications/detail/index.html";
  if (/^\/student\/applications\/[^/]+$/.test(pathname)) {
    return "/student/applications/detail/index.html";
  }

  // Recruiter workspace
  if (pathname === "/recruiter/dashboard") return "/recruiter/dashboard/index.html";
  if (pathname === "/recruiter/company") return "/recruiter/company/index.html";
  if (pathname === "/recruiter/package") return "/recruiter/package/index.html";
  if (pathname === "/recruiter/jobs") return "/recruiter/jobs/index.html";
  if (pathname === "/recruiter/jobs/new") return "/recruiter/jobs/new/index.html";
  if (pathname === "/recruiter/jobs/edit") return "/recruiter/jobs/edit/index.html";
  if (pathname === "/recruiter/jobs/applicants") return "/recruiter/jobs/applicants/index.html";
  if (pathname === "/recruiter/jobs/ties") return "/recruiter/jobs/ties/index.html";
  if (pathname === "/recruiter/jobs/interview-setup") {
    return "/recruiter/jobs/interview-setup/index.html";
  }
  if (pathname === "/recruiter/jobs/interviews") return "/recruiter/jobs/interviews/index.html";

  if (/^\/recruiter\/jobs\/[^/]+\/edit$/.test(pathname)) {
    return "/recruiter/jobs/edit/index.html";
  }
  if (/^\/recruiter\/jobs\/[^/]+\/applicants$/.test(pathname)) {
    return "/recruiter/jobs/applicants/index.html";
  }
  if (/^\/recruiter\/jobs\/[^/]+\/ties\/[^/]+$/.test(pathname)) {
    return "/recruiter/jobs/ties/index.html";
  }
  if (/^\/recruiter\/jobs\/[^/]+\/interview-setup$/.test(pathname)) {
    return "/recruiter/jobs/interview-setup/index.html";
  }
  if (/^\/recruiter\/jobs\/[^/]+\/interviews$/.test(pathname)) {
    return "/recruiter/jobs/interviews/index.html";
  }

  if (pathname === "/recruiter/applications/detail") {
    return "/recruiter/applications/detail/index.html";
  }
  if (pathname === "/recruiter/applications/interview-report") {
    return "/recruiter/applications/interview-report/index.html";
  }
  if (/^\/recruiter\/applications\/[^/]+\/interview-report$/.test(pathname)) {
    return "/recruiter/applications/interview-report/index.html";
  }
  if (/^\/recruiter\/applications\/[^/]+$/.test(pathname)) {
    return "/recruiter/applications/detail/index.html";
  }

  // Dynamic public/candidate routes
  if (pathname === "/jobs/detail") return "/jobs/detail/index.html";
  if (pathname === "/jobs/apply") return "/jobs/apply/index.html";
  if (/^\/jobs\/[^/]+\/apply$/.test(pathname)) return "/jobs/apply/index.html";
  if (/^\/jobs\/[^/]+$/.test(pathname)) return "/jobs/detail/index.html";

  if (pathname === "/p" || /^\/p\/[^/]+$/.test(pathname)) return "/p/index.html";
  if (pathname === "/interview" || /^\/interview\/[^/]+$/.test(pathname)) {
    return "/interview/index.html";
  }

  return null;
}
