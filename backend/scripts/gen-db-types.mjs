import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const outFile = path.join(repoRoot, "backend/src/supabase/database.types.ts");

const header = `/**
 * Generated Postgres types for public schema. Do not edit by hand.
 * Regen: npm run db:types -w @css-atlas/backend
 */

`;

const generated = execFileSync(
  "supabase",
  ["gen", "types", "typescript", "--linked", "--schema", "public"],
  { cwd: repoRoot, encoding: "utf8" }
);

await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(
  outFile,
  generated.startsWith("/**") ? generated : header + generated,
  "utf8"
);