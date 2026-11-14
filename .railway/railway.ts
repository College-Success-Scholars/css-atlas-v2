import { defineRailway, github, preserve, project, service } from "railway/iac";

/**
 * CSS Atlas infrastructure, one file for both environments.
 *
 * The CLI evaluates this file against whichever environment is linked
 * (`railway link`), so `prod` decides what that environment should look like.
 *
 *   develop (staging) -> deploys `develop`, crons exist but have NO schedule and NO Slack token
 *   production        -> deploys `main`, crons run on a schedule and can message people
 *
 * Rules:
 *   - Secrets are always `preserve()`. Never inline a secret value here.
 *   - Never run `railway config pull --include-variables`.
 *   - Settings in this file are changed here, not in the Railway dashboard.
 *   - Before merging a change, `railway config plan` must be clean for BOTH environments.
 */
export default defineRailway((ctx) => {
  const prod = ctx.isEnvironment("production");

  const source = github("College-Success-Scholars/css-atlas-v2", {
    branch: prod ? "main" : "develop",
    checkSuites: true, // "Wait for CI": skip deploys when GitHub Actions fail
  });

  const region = { "us-east4-eqdc4a": 1 };

  // ── Web services (same service in both environments) ──────────────────────

  const frontend = service("frontend", {
    source,
    build: {
      buildCommand: "",
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/Dockerfile.frontend",
      watchPatterns: ["/frontend/**", "/shared/**", "Dockerfile.frontend"],
    },
    replicas: region,
    deploy: {
      ipv6EgressEnabled: true,
      limitOverride: { containers: { cpu: 1, memoryBytes: 3000000000 } },
    },
    networking: { privateNetworkEndpoint: "inspiring-success" },
    // Railway-generated *.up.railway.app domains are not managed here.
    ...(prod ? { domains: [{ domain: "cssatlas.org", port: 8080 }] } : {}),
    // Migrated from frontend/railway.toml (Config as Code, retired 2026-12-01).
    healthcheck: "/",
    healthcheckTimeout: 30,
    env: {
      BACKEND_URL: preserve(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: preserve(),
      NEXT_PUBLIC_SUPABASE_URL: preserve(),
    },
  });

  const backend = service("backend", {
    source,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/Dockerfile.backend",
      watchPatterns: ["/backend/**", "/shared/**", "Dockerfile.backend"],
    },
    replicas: region,
    deploy: { ipv6EgressEnabled: true },
    networking: { privateNetworkEndpoint: "clever-eagerness" },
    // Migrated from backend/railway.toml (Config as Code, retired 2026-12-01).
    healthcheck: "/",
    healthcheckTimeout: 30,
    env: {
      CORS_ORIGIN: preserve(),
      SUPABASE_PUBLISHABLE_KEY: preserve(),
      SUPABASE_URL: preserve(),
    },
  });

  // ── Notification crons ─────────────────────────────────────────────────────
  // Each environment has its own pair of cron services (d-* in staging,
  // p-* in production), so each pair is only declared for its environment.

  const cronBuild = (dockerfile: string) => ({
    buildEnvironment: "V3" as const,
    builder: "DOCKERFILE" as const,
    dockerfilePath: `/${dockerfile}`,
    watchPatterns: ["/backend/**", "/shared/**", dockerfile],
  });

  // Staging: no cronSchedule (run by hand), no SLACK_BOT_TOKEN, no APP_BASE_URL.
  // That's what guarantees staging can never message team leaders.
  const stagingCrons = () => [
    service("d-signin-notif-cron", {
      source,
      build: cronBuild("Dockerfile.signin"),
      start: "bun run backend/src/domains/notifications/detectors/signin-detector.ts",
      replicas: region,
      networking: { privateNetworkEndpoint: "signin-notification-cron" },
      env: {
        NOTIFICATIONS_LAUNCH_DATE: preserve(),
        SUPABASE_SERVICE_ROLE_KEY: preserve(),
        SUPABASE_URL: preserve(),
      },
    }),
    service("d-recon-notif-cron", {
      source,
      build: cronBuild("Dockerfile.recon"),
      start: "bun run backend/src/domains/notifications/detectors/reconciliation-detector.ts",
      replicas: region,
      networking: { privateNetworkEndpoint: "reconciliation-notification-cron" },
      env: {
        NOTIFICATIONS_LAUNCH_DATE: preserve(),
        SUPABASE_PUBLISHABLE_KEY: preserve(),
        SUPABASE_SERVICE_ROLE_KEY: preserve(),
        SUPABASE_URL: preserve(),
      },
    }),
  ];

  // Production: schedules are UTC. 0 12 * * * = 7am ET in winter, 8am ET in summer.
  const productionCrons = () => [
    service("p-signin-notif-cron", {
      source,
      build: cronBuild("Dockerfile.signin"),
      replicas: region,
      deploy: { cronSchedule: "*/5 * * * *", restartPolicyType: "NEVER" },
      networking: { privateNetworkEndpoint: "signin-cron" },
      env: {
        APP_BASE_URL: preserve(),
        NOTIFICATIONS_LAUNCH_DATE: preserve(),
        SLACK_BOT_TOKEN: preserve(),
        SUPABASE_SERVICE_ROLE_KEY: preserve(),
        SUPABASE_URL: preserve(),
      },
    }),
    service("p-recon-notif-cron", {
      source,
      build: cronBuild("Dockerfile.recon"),
      replicas: region,
      deploy: { cronSchedule: "0 12 * * *", restartPolicyType: "NEVER" },
      networking: { privateNetworkEndpoint: "reconciliation-cron" },
      env: {
        APP_BASE_URL: preserve(),
        NOTIFICATIONS_LAUNCH_DATE: preserve(),
        SLACK_BOT_TOKEN: preserve(),
        SUPABASE_SERVICE_ROLE_KEY: preserve(),
        SUPABASE_URL: preserve(),
      },
    }),
  ];

  return project("css-atlas", {
    variables: { managed: true },
    resources: [frontend, backend, ...(prod ? productionCrons() : stagingCrons())],
  });
});
