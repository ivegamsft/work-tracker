import { AppError } from "../errors";

export function notImplemented(feature: string): never {
  throw new AppError(501, `${feature} is not yet implemented`, "NOT_IMPLEMENTED");
}
