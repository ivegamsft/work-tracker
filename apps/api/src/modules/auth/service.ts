import bcrypt from "bcryptjs";
import { v5 as uuidv5 } from "uuid";
import { Roles, UnauthorizedError } from "@e-clat/shared";
import { RegisterInput, LoginInput, RefreshTokenInput, ChangePasswordInput } from "./validators";
import { notImplemented } from "../../common/utils";
import {
  type AuthTokenUser,
  getAccessTokenLifetimeSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthService {
  register(input: RegisterInput): Promise<{ id: string }>;
  login(input: LoginInput): Promise<AuthTokens>;
  refreshToken(input: RefreshTokenInput): Promise<AuthTokens>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
  oauthCallback(provider: string, code: string): Promise<AuthTokens>;
}

interface MockAuthUser extends AuthTokenUser {
  passwordHash: string;
}

const MOCK_USER_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const MOCK_PASSWORD_HASH = "$2b$10$ZjJCuZWxfaG9NT8p6R6iV.7yMWy.kHequ/VpRsnTk/zp4ZkbdCPdi";

const mockUsers: MockAuthUser[] = [
  { id: uuidv5("employee@example.com", MOCK_USER_NAMESPACE), email: "employee@example.com", role: Roles.EMPLOYEE, passwordHash: MOCK_PASSWORD_HASH },
  { id: uuidv5("supervisor@example.com", MOCK_USER_NAMESPACE), email: "supervisor@example.com", role: Roles.SUPERVISOR, passwordHash: MOCK_PASSWORD_HASH },
  { id: uuidv5("manager@example.com", MOCK_USER_NAMESPACE), email: "manager@example.com", role: Roles.MANAGER, passwordHash: MOCK_PASSWORD_HASH },
  { id: uuidv5("compliance@example.com", MOCK_USER_NAMESPACE), email: "compliance@example.com", role: Roles.COMPLIANCE_OFFICER, passwordHash: MOCK_PASSWORD_HASH },
  { id: uuidv5("admin@example.com", MOCK_USER_NAMESPACE), email: "admin@example.com", role: Roles.ADMIN, passwordHash: MOCK_PASSWORD_HASH },
];

function findMockUserByEmail(email: string) {
  return mockUsers.find((user) => user.email === email.trim().toLowerCase());
}

function buildTokens(user: AuthTokenUser, refreshToken = signRefreshToken(user)): AuthTokens {
  const accessToken = signAccessToken(user);

  return {
    accessToken,
    refreshToken,
    expiresIn: getAccessTokenLifetimeSeconds(accessToken),
  };
}

export const authService: AuthService = {
  register: () => notImplemented("register"),
  async login(input) {
    const user = findMockUserByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return buildTokens(user);
  },
  async refreshToken(input) {
    const user = verifyRefreshToken(input.refreshToken);
    return buildTokens(user, input.refreshToken);
  },
  changePassword: () => notImplemented("changePassword"),
  oauthCallback: () => notImplemented("oauthCallback"),
};
