import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AppEnv } from "./env";

let jwks: JWTVerifyGetKey | undefined;
let jwksDomain = "";

/**
 * The email of the person Cloudflare Access let through to /admin, or null.
 * Checked here as well as by Access, so /admin stays closed if the Access
 * policy is ever removed. Empty settings refuse everyone.
 */
export async function verifyAccess(request: Request, env: AppEnv): Promise<string | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  try {
    if (!jwks || jwksDomain !== env.ACCESS_TEAM_DOMAIN) {
      jwks = createRemoteJWKSet(new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`));
      jwksDomain = env.ACCESS_TEAM_DOMAIN;
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    });
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
