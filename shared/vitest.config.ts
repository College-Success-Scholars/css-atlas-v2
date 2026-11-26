import { defineConfig } from "vitest/config";

process.env.TZ = "America/New_York";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});