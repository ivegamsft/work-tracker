import request from "supertest";
import { Roles } from "@e-clat/shared";
import { describe, expect, it, vi } from "vitest";
import { createTestApp, generateTestToken } from "./helpers";
import { documentsService, type PaginatedResult } from "../src/modules/documents/service";

describe("API routing", () => {
  it("mounts labels endpoints under /api/labels", async () => {
    const app = createTestApp();

    const labelsResponse = await request(app).get("/api/labels/versions");
    const wrongBaseResponse = await request(app).get("/api/versions");

    expect(labelsResponse.status).toBe(401);
    expect(wrongBaseResponse.status).toBe(404);
  });

  it("matches /review-queue before the document :id route", async () => {
    const reviewQueue: PaginatedResult<any> = {
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    };

    const listReviewQueueSpy = vi
      .spyOn(documentsService, "listReviewQueue")
      .mockResolvedValue(reviewQueue as PaginatedResult<never>);
    const getDocumentSpy = vi
      .spyOn(documentsService, "getDocument")
      .mockResolvedValue({ id: "review-queue" } as never);

    const response = await request(createTestApp())
      .get("/api/documents/review-queue")
      .set("Authorization", `Bearer ${generateTestToken(Roles.MANAGER)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(reviewQueue);
    expect(listReviewQueueSpy).toHaveBeenCalledWith(1, 50);
    expect(getDocumentSpy).not.toHaveBeenCalled();
  });
});
