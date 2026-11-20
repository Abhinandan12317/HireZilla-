import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";

function collectHtmlInputs(baseDir: string, currentDir = baseDir): Record<string, string> {
  const inputs: Record<string, string> = {};
  if (!fs.existsSync(currentDir)) return inputs;
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
  const frontendDir = path.resolve(__dirname, "frontend");

  return {
    root: frontendDir,
    appType: "mpa" as const,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "copy-unbundled-src-assets",
        apply: "build" as const,
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, "dist");
          const srcAssets = path.resolve(frontendDir, "src/assets");
          const distAssets = path.resolve(distDir, "src/assets");
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: collectHtmlInputs(frontendDir),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
