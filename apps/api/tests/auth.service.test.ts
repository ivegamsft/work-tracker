import { Roles } from "@e-clat/shared";
import { describe, expect, it } from "vitest";
import { authService } from "../src/modules/auth/service";
import { verifyAccessToken, verifyRefreshToken } from "../src/modules/auth/tokens";

describe("authService", () => {
  it("returns signed access and refresh tokens for a known mock user", async () => {
    const tokens = await authService.login({
      email: "manager@example.com",
      password: "Password123!",
    });

    expect(tokens.expiresIn).toBeGreaterThan(0);
    expect(verifyAccessToken(tokens.accessToken)).toMatchObject({
      email: "manager@example.com",
      role: Roles.MANAGER,
    });
    expect(verifyRefreshToken(tokens.refreshToken)).toMatchObject({
      email: "manager@example.com",
      role: Roles.MANAGER,
    });
  });

  it("refreshes an access token from a valid refresh token", async () => {
    const initialTokens = await authService.login({
      email: "manager@example.com",
      password: "Password123!",
    });

    const refreshedTokens = await authService.refreshToken({
      refreshToken: initialTokens.refreshToken,
    });

    expect(refreshedTokens.refreshToken).toBe(initialTokens.refreshToken);
    expect(verifyAccessToken(refreshedTokens.accessToken)).toMatchObject({
      email: "manager@example.com",
      role: Roles.MANAGER,
    });
  });

  it("rejects invalid credentials", async () => {
    await expect(authService.login({
      email: "manager@example.com",
      password: "wrong-password",
    })).rejects.toThrow("Invalid email or password");
  });
});
