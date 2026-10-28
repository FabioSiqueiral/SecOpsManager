import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3300",
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
