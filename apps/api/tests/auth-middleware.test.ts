import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

describe("authentication middleware", () => {
  it("returns 401 for protected routes without a bearer token", async () => {
    const response = await request(createTestApp()).get("/api/employees");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });
});
