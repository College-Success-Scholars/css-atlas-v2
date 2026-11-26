import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load .env before test workers start so SUPABASE_URL etc. are present
// when app.ts / supabase/client.ts are first imported.
config();

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});