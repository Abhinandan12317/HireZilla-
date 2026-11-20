import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import { resolveMpaHtmlPath } from "../shared/mpaRoutes";

function collectHtmlInputs(baseDir: string, currentDir = baseDir): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "aws") {
      continue;
    }
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(inputs, collectHtmlInputs(baseDir, fullPath));
    } else if (entry.name === "index.html") {
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const key =
        rel === "index.html" ? "main" : rel.replace(/\/index\.html$/, "").replace(/\//g, "_");
      inputs[key] = fullPath;
    }
  }
  return inputs;
}

export default defineConfig(() => {
  const apiProxyTarget = process.env.BACKEND_URL || "http://localhost:4000";

  return {
    root: __dirname,
    appType: "mpa" as const,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "hirezilla-mpa-dev-rewrite",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.method === "GET" && req.url) {
              const [pathname, query] = req.url.split("?");
              const mapped = resolveMpaHtmlPath(pathname);
              if (mapped) {
                req.url = query ? `${mapped}?${query}` : mapped;
              }
            }
            next();
          });
        },
      },
    ],
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: collectHtmlInputs(__dirname),
      },
    },
    server: {
      port: Number(process.env.PORT || 5173),
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
