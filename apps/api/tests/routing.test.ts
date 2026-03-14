import { request } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Roles } from "@e-clat/shared";
import { createApp } from "../src/index";
import { signAccessToken } from "../src/modules/auth/tokens";
import { documentsService, type PaginatedResult } from "../src/modules/documents/service";

function sendRequest(server: Server, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const address = server.address() as AddressInfo;
    const req = request({
      host: "127.0.0.1",
      port: address.port,
      path,
      method: "GET",
      headers,
    }, (res) => {
      let rawBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        rawBody += chunk;
      });
      res.on("end", () => {
        const body = res.headers["content-type"]?.includes("application/json") && rawBody
          ? JSON.parse(rawBody)
          : rawBody;

        resolve({
          status: res.statusCode ?? 0,
          body,
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

describe("API routing", () => {
  let server: Server;

  beforeAll(() => {
    server = createApp().listen(0);
  });

  afterAll((done) => {
    server.close(done);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mounts labels endpoints under /api/labels", async () => {
    const labelsResponse = await sendRequest(server, "/api/labels/versions");
    const wrongBaseResponse = await sendRequest(server, "/api/versions");

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

    const listReviewQueueSpy = jest
      .spyOn(documentsService, "listReviewQueue")
      .mockResolvedValue(reviewQueue as PaginatedResult<never>);
    const getDocumentSpy = jest
      .spyOn(documentsService, "getDocument")
      .mockResolvedValue({ id: "review-queue" } as never);

    const accessToken = signAccessToken({
      id: "manager-1",
      email: "manager@example.com",
      role: Roles.MANAGER,
    });

    const response = await sendRequest(server, "/api/documents/review-queue", {
      authorization: `Bearer ${accessToken}`,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(reviewQueue);
    expect(listReviewQueueSpy).toHaveBeenCalledWith(1, 50);
    expect(getDocumentSpy).not.toHaveBeenCalled();
  });
});
