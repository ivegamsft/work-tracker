import { AppError } from "@e-clat/shared";

export function notImplemented(feature: string): never {
  throw new AppError(501, `${feature} is not yet implemented`, "NOT_IMPLEMENTED");
}
