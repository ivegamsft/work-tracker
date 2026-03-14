import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/setup-env.ts"],
  moduleNameMapper: {
    "^@config/(.*)$": "<rootDir>/src/config/$1",
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
    "^@middleware/(.*)$": "<rootDir>/src/middleware/$1",
    "^@common/(.*)$": "<rootDir>/src/common/$1",
  },
};

export default config;
