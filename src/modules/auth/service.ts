import { RegisterInput, LoginInput, RefreshTokenInput, ChangePasswordInput } from "./validators";
import { notImplemented } from "../../common/utils";

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

export const authService: AuthService = {
  register: () => notImplemented("register"),
  login: () => notImplemented("login"),
  refreshToken: () => notImplemented("refreshToken"),
  changePassword: () => notImplemented("changePassword"),
  oauthCallback: () => notImplemented("oauthCallback"),
};
