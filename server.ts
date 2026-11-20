import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createApp } from "./backend/src/app";
import { config } from "./backend/src/config";
import { connectDatabase } from "./backend/src/db/database";
import { logEvent } from "./backend/src/services/audit";
import { ensureSeedData } from "./backend/src/services/seed";
import { resolveMpaHtmlPath } from "./shared/mpaRoutes";

async function main() {
  const dbStatus = await connectDatabase();
  await ensureSeedData();

  if (config.usingEphemeralSecrets) {
    logEvent("warn", "ephemeral_dev_secrets_in_use", {
      note: "Set SESSION_SECRET and SIGNED_URL_SECRET in environment for persistent sessions across restarts.",
    });
  }

  const app = createApp();
  const previewPort = Number(process.env.PORT || 3000);

  if (config.nodeEnv !== "production") {
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "mpa",
    });

    // Rewrite clean MPA URLs (including dynamic /jobs/:id, /p/:slug, etc.)
    // to their dedicated static HTML document before Vite MPA middleware.
    app.use((req, _res, next) => {
      if (req.method === "GET" && req.url) {
        const [pathname, query] = req.url.split("?");
        const mappedHtml = resolveMpaHtmlPath(pathname);
        if (mappedHtml) {
          req.url = query ? `${mappedHtml}?${query}` : mappedHtml;
        }
      }
      next();
    });

    app.use(vite.middlewares);

    app.use((_req, res) => {
      res.status(404).send("Page not found.");
    });
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir, { index: false }));
    app.get("*", (req, res) => {
      const mappedHtml = resolveMpaHtmlPath(req.path);
      if (!mappedHtml) {
        res.status(404).send("Page not found.");
        return;
      }
      const targetHtml = path.join(distDir, mappedHtml.replace(/^\/+/, ""));
      if (fs.existsSync(targetHtml)) {
        res.sendFile(targetHtml);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  app.listen(previewPort, "0.0.0.0", () => {
    logEvent("info", "hirezilla_preview_orchestrator_started", {
      port: previewPort,
      mode: "mpa_plus_backend",
      dbMode: dbStatus.mode,
      geminiConfigured: Boolean(config.geminiApiKey),
      googleOAuthConfigured: Boolean(config.googleClientId),
    });
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
