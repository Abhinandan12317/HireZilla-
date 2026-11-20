import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { resolveMpaHtmlPath } from "../shared/mpaRoutes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const DIST_DIR = path.resolve(__dirname, "dist");
const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/+$/, "");

function createApiReverseProxy(targetBase: string): express.RequestHandler {
  const target = new URL(targetBase);
  const transport = target.protocol === "https:" ? https : http;

  return (req, res) => {
    const headers: Record<string, string | string[] | undefined> = {
      ...req.headers,
      host: target.host,
    };

    const proxyReq = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        method: req.method,
        path: req.originalUrl,
        headers,
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        for (const [key, val] of Object.entries(proxyRes.headers)) {
          if (val !== undefined) {
            res.setHeader(key, val);
          }
        }
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.status(502).json({
          error: "Upstream HireZilla backend unavailable.",
          detail: err.message,
        });
      }
    });

    req.pipe(proxyReq);
  };
}

function main() {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "hirezilla-frontend",
      mode: "mpa",
      backendProxyConfigured: Boolean(BACKEND_URL),
    });
  });

  if (BACKEND_URL) {
    app.use("/api", createApiReverseProxy(BACKEND_URL));
  }

  // Serve built static assets (JS/CSS chunks, fonts, images)
  app.use(express.static(DIST_DIR, { index: false }));

  // Non-SPA Multi-Page HTML Resolution (no catch-all SPA fallback)
  app.get("*", (req, res) => {
    const mappedHtml = resolveMpaHtmlPath(req.path);
    if (!mappedHtml) {
      res.status(404).send("Page not found.");
      return;
    }
    const targetFile = path.join(DIST_DIR, mappedHtml.replace(/^\/+/, ""));
    if (!fs.existsSync(targetFile)) {
      res.status(404).send("Built MPA page not found. Run npm run build first.");
      return;
    }
    res.sendFile(targetFile);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      JSON.stringify({
        level: "info",
        event: "hirezilla_frontend_mpa_started",
        port: PORT,
        distDir: DIST_DIR,
        backendProxyTarget: BACKEND_URL || null,
      })
    );
  });
}

main();
