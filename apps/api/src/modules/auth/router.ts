import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware";
import { authService } from "./service";
import { registerSchema, loginSchema, refreshTokenSchema, changePasswordSchema } from "./validators";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const tokens = await authService.login(input);
    res.json(tokens);
  } catch (err) { next(err); }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const input = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refreshToken(input);
    res.json(tokens);
  } catch (err) { next(err); }
});

router.post("/change-password", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, input);
    res.json({ message: "Password changed" });
  } catch (err) { next(err); }
});

router.get("/oauth/callback", async (req, res, next) => {
  try {
    const { provider, code } = req.query as { provider: string; code: string };
    const tokens = await authService.oauthCallback(provider, code);
    res.json(tokens);
  } catch (err) { next(err); }
});

export { router as authRouter };
