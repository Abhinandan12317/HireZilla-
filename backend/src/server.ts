import "dotenv/config";
import { createApp } from "./app";
import { config } from "./config";
import { connectDatabase } from "./db/database";
import { logEvent } from "./services/audit";
import { ensureSeedData } from "./services/seed";

async function startBackend() {
  const dbStatus = await connectDatabase();
  await ensureSeedData();

  if (config.usingEphemeralSecrets) {
    logEvent("warn", "ephemeral_dev_secrets_in_use", {
      note: "Set SESSION_SECRET and SIGNED_URL_SECRET in environment for persistent sessions across restarts.",
    });
  }

  const app = createApp();
  app.listen(config.port, "0.0.0.0", () => {
    logEvent("info", "hirezilla_backend_started", {
      port: config.port,
      dbMode: dbStatus.mode,
      frontendUrl: config.frontendUrl,
      corsOrigins: config.corsOrigins,
      geminiConfigured: Boolean(config.geminiApiKey),
      googleOAuthConfigured: Boolean(config.googleClientId),
    });
  });
}

startBackend().catch((err) => {
  console.error("Fatal backend startup error:", err);
  process.exit(1);
});
