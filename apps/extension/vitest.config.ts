import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/entrypoints/**", "wxt.config.ts"],
      thresholds: { lines: 90 },
    },
  },
});
