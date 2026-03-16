import request from "supertest";
import { Roles } from "@e-clat/shared";
import { describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken, seededTestUsers } from "./helpers";
import { createPlatformRouter } from "../src/modules/platform";
import type { FeatureFlagService } from "../src/services/feature-flags";

describe("Platform feature flags endpoint", () => {
  it("requires authentication", async () => {
    const response = await request(createTestApp()).get("/api/v1/platform/feature-flags");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns only client-visible flags for authenticated users", async () => {
    const response = await request(createTestApp())
      .get("/api/v1/platform/feature-flags")
      .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=300");
    expect(response.body).toEqual({
      "records.hours-ui": false,
      "reference.labels-admin": false,
      "compliance.templates": false,
      "web.team-subnav": false,
    });
    expect(response.body).not.toHaveProperty("notifications.escalation-rules");
  });

  it("builds the resolution context from the authenticated user", async () => {
    const getClientFlags = vi.fn().mockReturnValue({ "records.hours-ui": true });
    const featureFlags: FeatureFlagService = {
      isEnabled: vi.fn().mockReturnValue(true),
      requireEnabled: vi.fn(),
      getClientFlags,
    };

    const app = createTestApp({
      registerRoutes(expressApp) {
        expressApp.use(
          "/test-platform",
          createPlatformRouter({
            featureFlags,
            resolveEnvironment: () => "staging",
          }),
        );
      },
    });

    const response = await request(app)
      .get("/test-platform/feature-flags")
      .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ "records.hours-ui": true });
    expect(getClientFlags).toHaveBeenCalledWith({
      userId: seededTestUsers.manager.id,
      email: seededTestUsers.manager.email,
      role: Roles.MANAGER,
      environment: "staging",
    });
  });
});
