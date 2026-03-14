import type { Response } from "express";
import { UnauthorizedError, Roles } from "@e-clat/shared";
import { authenticate, type AuthenticatedRequest } from "../src/middleware/auth";
import { signAccessToken, signRefreshToken } from "../src/modules/auth/tokens";

function runAuthenticate(req: Partial<AuthenticatedRequest>) {
  return new Promise<unknown>((resolve) => {
    authenticate(req as AuthenticatedRequest, {} as Response, (error?: unknown) => resolve(error));
  });
}

describe("authenticate middleware", () => {
  it("attaches the verified access-token user to the request", async () => {
    const token = signAccessToken({
      id: "manager-1",
      email: "manager@example.com",
      role: Roles.MANAGER,
    });

    const req: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };

    const error = await runAuthenticate(req);

    expect(error).toBeUndefined();
    expect(req.user).toEqual({
      id: "manager-1",
      email: "manager@example.com",
      role: Roles.MANAGER,
    });
  });

  it("rejects refresh tokens on protected routes", async () => {
    const token = signRefreshToken({
      id: "manager-1",
      email: "manager@example.com",
      role: Roles.MANAGER,
    });

    const error = await runAuthenticate({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).message).toBe("Invalid or expired token");
  });

  it("rejects malformed bearer tokens", async () => {
    const error = await runAuthenticate({
      headers: { authorization: "Bearer definitely-not-a-jwt" },
    });

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).message).toBe("Invalid or expired token");
  });
});
