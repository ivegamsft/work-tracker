import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const fromRoot = (...segments: string[]) => resolve(rootDir, ...segments);

export default defineConfig({
  resolve: {
    alias: {
      "@config": fromRoot("apps", "api", "src", "config"),
      "@modules": fromRoot("apps", "api", "src", "modules"),
      "@middleware": fromRoot("apps", "api", "src", "middleware"),
      "@common": fromRoot("apps", "api", "src", "common"),
      "@e-clat/shared": fromRoot("packages", "shared", "src", "index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: [fromRoot("apps", "api", "tests", "setup.ts")],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "**/*.d.ts",
        "**/dist/**",
        "**/tests/**",
        "**/*.config.*",
        "apps/api/src/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
