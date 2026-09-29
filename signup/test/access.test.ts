import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { verifyAccess } from "../src/access";
import type { AppEnv } from "../src/env";

const base: AppEnv = {
  DB: env.DB,
  SIGNUP_LIMIT: { limit: async () => ({ success: true }) } as RateLimit,
  SIGNUP_PASSWORD: "x",
  ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
  ACCESS_AUD: "aud123",
};
const withToken = (token?: string) =>
  new Request("https://join.myminecraft.party/admin", { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} });

describe("verifyAccess", () => {
  it("refuses a request with no token", async () => {
    expect(await verifyAccess(withToken(), base)).toBeNull();
  });
  it("refuses everyone while Access is not configured", async () => {
    expect(await verifyAccess(withToken("a.b.c"), { ...base, ACCESS_AUD: "" })).toBeNull();
    expect(await verifyAccess(withToken("a.b.c"), { ...base, ACCESS_TEAM_DOMAIN: "" })).toBeNull();
  });
  it("refuses a malformed token", async () => {
    expect(await verifyAccess(withToken("not-a-jwt"), base)).toBeNull();
  });
});
