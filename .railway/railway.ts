import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const cssAtlasV2 = github("College-Success-Scholars/css-atlas-v2", { branch: "develop", checkSuites: true });

  const frontend = service("frontend", {
    source: github("College-Success-Scholars/css-atlas-v2", { branch: "develop", checkSuites: true }),
    build: { buildCommand: "", buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/Dockerfile.frontend", watchPatterns: ["/frontend/**", "/shared/**", "Dockerfile.frontend"] },
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { ipv6EgressEnabled: true, limitOverride: { containers: { cpu: 1, memoryBytes: 3000000000 } } },
    networking: { privateNetworkEndpoint: "inspiring-success" },
    env: { 
      BACKEND_URL: preserve(), 
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: preserve(), 
      NEXT_PUBLIC_SUPABASE_URL: preserve() 
    },
  });

  const backend = service("backend", {
    source: cssAtlasV2,
    build: { 
      buildEnvironment: "V3", 
      builder: "DOCKERFILE", 
      dockerfilePath: "/Dockerfile.backend", 
      watchPatterns: ["/backend/**", "/shared/**", "Dockerfile.backend"] 
    },
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { ipv6EgressEnabled: true },
    networking: { privateNetworkEndpoint: "clever-eagerness" },
    env: { 
      CORS_ORIGIN: preserve(), 
      SUPABASE_PUBLISHABLE_KEY: preserve(), 
      SUPABASE_URL: preserve() 
    },
  });

  const dReconNotifCron = service("d-recon-notif-cron", {
    source: cssAtlasV2,
    build: { 
      buildEnvironment: "V3", 
      builder: "DOCKERFILE", 
      dockerfilePath: "/Dockerfile.recon", 
      watchPatterns: ["/backend/**", "/shared/**", "Dockerfile.recon"] 
    },
    start: "bun run backend/src/domains/notifications/detectors/reconciliation-detector.ts",
    replicas: { "us-east4-eqdc4a": 1 },
    networking: { privateNetworkEndpoint: "reconciliation-notification-cron" },
    env: { 
      NOTIFICATIONS_LAUNCH_DATE: preserve(), 
      SUPABASE_PUBLISHABLE_KEY: preserve(), 
      SUPABASE_SERVICE_ROLE_KEY: preserve(), 
      SUPABASE_URL: preserve() 
    },
  });

  const dSigninNotifCron = service("d-signin-notif-cron", {
    source: cssAtlasV2,
    build: { 
      buildEnvironment: "V3", 
      builder: "DOCKERFILE", 
      dockerfilePath: "/Dockerfile.signin", 
      watchPatterns: ["/backend/**", "/shared/**", "Dockerfile.signin"] 
    },
    start: "bun run backend/src/domains/notifications/detectors/signin-detector.ts",
    replicas: { "us-east4-eqdc4a": 1 },
    networking: { privateNetworkEndpoint: "signin-notification-cron" },
    env: { 
      NOTIFICATIONS_LAUNCH_DATE: preserve(), 
      SUPABASE_SERVICE_ROLE_KEY: preserve(), 
      SUPABASE_URL: preserve() 
    },
  });

  return project("css-atlas", {
    variables: { managed: true },
    resources: [dSigninNotifCron, backend, dReconNotifCron, frontend],
  });
});
