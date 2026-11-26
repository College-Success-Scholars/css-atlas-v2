import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

process.env.TZ = "America/New_York";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["{app,components,lib,hooks}/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});