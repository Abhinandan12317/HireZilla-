# HireZilla — Decoupled AWS Deployment Guide

HireZilla is structured into three independent workspace parts so the **Frontend (MPA)** and **Backend (Express REST API + AI + PDF processing)** can be deployed, scaled, and secured independently on AWS:

```
hirezilla/
├── backend/     # Standalone Express API, MongoDB repository, PDF validation, Gemini AI service
├── frontend/    # Standalone Multi-Page Application (MPA — zero react-router-dom / no SPA fallback)
└── shared/      # Shared TypeScript contracts, fixed scoring weights, and MPA route map
```

---

## Option A: AWS S3 + CloudFront (Frontend MPA) + ECS Fargate / App Runner (Backend API)

### 1. Deploy the Backend (`/backend`)
1. Build and push the backend container from the **repository root** (so `/shared` is included):
   ```bash
   docker build -f backend/Dockerfile -t hirezilla-backend:latest .
   ```
2. Run on **AWS ECS Fargate** or **AWS App Runner** (listening on port `4000`) behind an HTTPS Application Load Balancer (e.g., `https://api.yourdomain.com`).
3. Configure environment variables on the backend service:
   - `NODE_ENV=production`
   - `BACKEND_PORT=4000`
   - `FRONTEND_URL=https://app.yourdomain.com`
   - `APP_URL=https://app.yourdomain.com`
   - `CORS_ORIGIN=https://app.yourdomain.com`
   - `COOKIE_SAME_SITE=none`
   - `COOKIE_SECURE=true`
   - `MONGODB_URI=mongodb+srv://...`
   - `GEMINI_API_KEY=...`
   - `SESSION_SECRET=<strong-random-64-hex>`
   - `SIGNED_URL_SECRET=<strong-random-64-hex>`

### 2. Deploy the Frontend MPA (`/frontend`)
1. Build the static MPA HTML pages + assets pointing at your backend domain:
   ```bash
   VITE_API_BASE_URL=https://api.yourdomain.com npm run build:frontend
   ```
   This outputs 26 distinct static HTML documents under `frontend/dist/**/index.html` plus hashed JS/CSS bundles in `frontend/dist/assets/`.
2. Sync `frontend/dist/` to your **S3 bucket**.
3. Attach **`frontend/aws/cloudfront-url-rewrite.js`** as a **CloudFront Viewer Request Function** so clean URLs (e.g. `/jobs/job_backend_sr`, `/recruiter/jobs/job_backend_sr/applicants`, `/p/arjun-mehta`) rewrite cleanly to their corresponding static HTML file without any SPA catch-all fallback. Unknown routes return `404`.

---

## Option B: Two Independent Containers on AWS ECS / ALB (Frontend MPA Server + Backend API)

If you prefer running the frontend behind an ECS service with an internal reverse proxy (same-origin cookies, no CORS preflight):

1. Build the frontend container from the **repository root**:
   ```bash
   docker build -f frontend/Dockerfile -t hirezilla-frontend:latest .
   ```
2. Set `BACKEND_URL=http://<internal-backend-alb>:4000` on the frontend container (`frontend/server.ts` listens on port `5173`, serves each static MPA HTML file, proxies `/api/*` to `BACKEND_URL`, and returns HTTP `404` on unknown routes).
3. Put the frontend service behind your public ALB (`https://app.yourdomain.com`).

---

## Authentication Across Decoupled Domains

- The backend returns both an `HttpOnly` session cookie AND an HMAC-signed session `token` from `/api/auth/signup`, `/api/auth/google`, `/api/auth/demo-signin`, and `/api/auth/role`.
- `frontend/src/lib/api.ts` automatically resolves `VITE_API_BASE_URL`, sends `credentials: "include"`, and attaches `Authorization: Bearer <token>` from `sessionStorage` so cross-origin AWS deployments work seamlessly even when third-party cookies are blocked by browsers.
- Protected file downloads (`/api/resumes/:id/download`) use short-lived HMAC-signed URLs resolved via `apiUrl(...)` directly against the backend origin.
