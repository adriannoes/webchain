import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90 },
    },
  },
});
