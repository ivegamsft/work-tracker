export { tokenValidator, registerStrategy, getStrategy } from "./tokenValidator";
export type { TokenValidationResult, TokenValidationStrategy, ProviderConfig, TokenValidator } from "./tokenValidator";
export { jwksCache, JwksCache } from "./jwksCache";
export type { JwksKey } from "./jwksCache";
export { normalizeClaims, WELL_KNOWN_MAPPINGS } from "./claimsNormalizer";
export type { NormalizedClaims, ClaimsMapping } from "./claimsNormalizer";
