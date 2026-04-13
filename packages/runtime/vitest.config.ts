import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90 },
    },
  },
});
