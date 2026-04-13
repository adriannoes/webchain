import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.integration.test.ts", "src/index.ts"],
      thresholds: { lines: 90 },
    },
  },
});
