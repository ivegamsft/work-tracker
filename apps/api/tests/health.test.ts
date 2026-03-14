import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

describe("GET /health", () => {
  it("returns service health metadata", async () => {
    const response = await request(createTestApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "e-clat",
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });
});
