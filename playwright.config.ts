import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "rm -rf backend/data/e2e-runtime.sqlite backend/data/e2e-runtime.sqlite-shm backend/data/e2e-runtime.sqlite-wal backend/data/e2e-object-store && npm --prefix backend run build && APP_SESSION_SECRET=e2e-session-secret-2026-high-entropy-value PROCESSOR=fal PROCESSOR_FAILURE_POLICY=fallback-to-sharp DATABASE_PATH=backend/data/e2e-runtime.sqlite OBJECT_STORAGE_PATH=backend/data/e2e-object-store ALLOWED_ORIGINS=http://127.0.0.1:4173 PORT=3001 node backend/dist/index.js",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
