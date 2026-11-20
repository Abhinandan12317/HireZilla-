/**
 * AWS CloudFront Function (viewer-request) for HireZilla static S3 MPA hosting.
 * Maps clean HireZilla URLs (including dynamic IDs/slugs) to their built static
 * HTML files without turning the site into an SPA.
 */
function handler(event) {
  var request = event.request;
  var uri = (request.uri || "/").replace(/\/+$/, "") || "/";

  // Leave assets, scripts, and files with extensions untouched
  if (uri.indexOf("/assets/") === 0 || /\.[a-zA-Z0-9]+$/.test(uri)) {
    return request;
  }

  var exactMap = {
    "/": "/index.html",
    "/jobs": "/jobs/index.html",
    "/jobs/detail": "/jobs/detail/index.html",
    "/jobs/apply": "/jobs/apply/index.html",
    "/packages": "/packages/index.html",
    "/login": "/login/index.html",
    "/signup": "/signup/index.html",
    "/admin": "/admin/index.html",
    "/student/dashboard": "/student/dashboard/index.html",
    "/student/onboarding": "/student/onboarding/index.html",
    "/student/applications": "/student/applications/index.html",
    "/student/applications/detail": "/student/applications/detail/index.html",
    "/recruiter/dashboard": "/recruiter/dashboard/index.html",
    "/recruiter/company": "/recruiter/company/index.html",
    "/recruiter/package": "/recruiter/package/index.html",
    "/recruiter/jobs": "/recruiter/jobs/index.html",
    "/recruiter/jobs/new": "/recruiter/jobs/new/index.html",
    "/recruiter/jobs/edit": "/recruiter/jobs/edit/index.html",
    "/recruiter/jobs/applicants": "/recruiter/jobs/applicants/index.html",
    "/recruiter/jobs/ties": "/recruiter/jobs/ties/index.html",
    "/recruiter/jobs/interview-setup": "/recruiter/jobs/interview-setup/index.html",
    "/recruiter/jobs/interviews": "/recruiter/jobs/interviews/index.html",
    "/recruiter/applications/detail": "/recruiter/applications/detail/index.html",
    "/recruiter/applications/interview-report": "/recruiter/applications/interview-report/index.html"
  };

  if (exactMap[uri]) {
    request.uri = exactMap[uri];
    return request;
  }

  if (/^\/student\/applications\/[^/]+$/.test(uri)) {
    request.uri = "/student/applications/detail/index.html";
  } else if (/^\/recruiter\/jobs\/[^/]+\/edit$/.test(uri)) {
    request.uri = "/recruiter/jobs/edit/index.html";
  } else if (/^\/recruiter\/jobs\/[^/]+\/applicants$/.test(uri)) {
    request.uri = "/recruiter/jobs/applicants/index.html";
  } else if (/^\/recruiter\/jobs\/[^/]+\/ties\/[^/]+$/.test(uri)) {
    request.uri = "/recruiter/jobs/ties/index.html";
  } else if (/^\/recruiter\/jobs\/[^/]+\/interview-setup$/.test(uri)) {
    request.uri = "/recruiter/jobs/interview-setup/index.html";
  } else if (/^\/recruiter\/jobs\/[^/]+\/interviews$/.test(uri)) {
    request.uri = "/recruiter/jobs/interviews/index.html";
  } else if (/^\/recruiter\/applications\/[^/]+\/interview-report$/.test(uri)) {
    request.uri = "/recruiter/applications/interview-report/index.html";
  } else if (/^\/recruiter\/applications\/[^/]+$/.test(uri)) {
    request.uri = "/recruiter/applications/detail/index.html";
  } else if (/^\/jobs\/[^/]+\/apply$/.test(uri)) {
    request.uri = "/jobs/apply/index.html";
  } else if (/^\/jobs\/[^/]+$/.test(uri)) {
    request.uri = "/jobs/detail/index.html";
  } else if (/^\/p\/[^/]+$/.test(uri) || uri === "/p") {
    request.uri = "/p/index.html";
  } else if (/^\/interview\/[^/]+$/.test(uri) || uri === "/interview") {
    request.uri = "/interview/index.html";
  }

  return request;
}
