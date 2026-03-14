import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { Role, Roles, UnauthorizedError } from "@e-clat/shared";
import { env } from "../../config/env";

export interface AuthTokenUser {
  id: string;
  email: string;
  role: Role;
}

type TokenType = "access" | "refresh";

interface TokenPayload extends JwtPayload, AuthTokenUser {
  tokenType: TokenType;
}

function isRole(value: unknown): value is Role {
  return Object.values(Roles).includes(value as Role);
}

function signToken(user: AuthTokenUser, tokenType: TokenType, expiresIn: SignOptions["expiresIn"]) {
  return jwt.sign({ ...user, tokenType }, env.JWT_SECRET, { expiresIn });
}

function parseTokenPayload(decoded: string | JwtPayload | null): TokenPayload {
  if (
    !decoded
    || typeof decoded === "string"
    || typeof decoded.id !== "string"
    || typeof decoded.email !== "string"
    || !isRole(decoded.role)
    || (decoded.tokenType !== "access" && decoded.tokenType !== "refresh")
  ) {
    throw new UnauthorizedError("Invalid token");
  }

  return decoded as TokenPayload;
}

function verifyToken(token: string, expectedType: TokenType): AuthTokenUser {
  const decoded = parseTokenPayload(jwt.verify(token, env.JWT_SECRET));
  if (decoded.tokenType !== expectedType) {
    throw new UnauthorizedError("Invalid token");
  }

  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
  };
}

export function signAccessToken(user: AuthTokenUser) {
  return signToken(user, "access", env.JWT_EXPIRES_IN as SignOptions["expiresIn"]);
}

export function signRefreshToken(user: AuthTokenUser) {
  return signToken(user, "refresh", env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]);
}

export function verifyAccessToken(token: string) {
  return verifyToken(token, "access");
}

export function verifyRefreshToken(token: string) {
  return verifyToken(token, "refresh");
}

export function getAccessTokenLifetimeSeconds(accessToken: string) {
  const decoded = parseTokenPayload(jwt.decode(accessToken));
  if (typeof decoded.exp !== "number" || typeof decoded.iat !== "number") {
    return 0;
  }

  return decoded.exp - decoded.iat;
}
