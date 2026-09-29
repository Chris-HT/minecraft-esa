import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { handle, type Deps } from "../src/app";
import { listSignups, upsertSignup } from "../src/db";
import type { AppEnv } from "../src/env";

const NOW = new Date("2026-10-02T09:00:00.000Z");
const ORIGIN = "https://join.myminecraft.party";
const testEnv: AppEnv = {
  DB: env.DB,
  SIGNUP_LIMIT: { limit: async () => ({ success: true }) } as RateLimit,
  SIGNUP_PASSWORD: "creeper42",
  ACCESS_TEAM_DOMAIN: "",
  ACCESS_AUD: "",
};
const admin: Deps = { adminEmail: async () => "chris@example.com", now: () => NOW };
const stranger: Deps = { adminEmail: async () => null, now: () => NOW };

const setStatusRequest = (fields: Record<string, string>, origin: string | null = ORIGIN) =>
  new Request(`${ORIGIN}/admin/status`, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: origin ? { Origin: origin } : {},
  });

beforeEach(async () => {
  await env.DB.exec("DELETE FROM signups");
  await upsertSignup(env.DB, { mcName: "Steve", edition: "java", email: "steve@esa.ac", formGroup: "10B" }, new Date("2026-10-01T09:00:00.000Z"));
});

describe("/admin access", () => {
  it("refuses anyone Access has not verified", async () => {
    expect((await handle(new Request(`${ORIGIN}/admin`), testEnv, stranger)).status).toBe(403);
    expect((await handle(setStatusRequest({ email: "steve@esa.ac", status: "added" }), testEnv, stranger)).status).toBe(403);
    expect((await listSignups(testEnv.DB, "new"))).toHaveLength(1);
  });
});

describe("GET /admin", () => {
  it("lists new sign-ups by default", async () => {
    const res = await handle(new Request(`${ORIGIN}/admin`), testEnv, admin);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("/whitelist add Steve");
    expect(html).toContain("Signed in as chris@example.com");
  });

  it("filters", async () => {
    const html = await (await handle(new Request(`${ORIGIN}/admin?show=added`), testEnv, admin)).text();
    expect(html).toContain("Nothing here.");
  });
});

describe("POST /admin/status", () => {
  it("marks a sign-up added and redirects back to the same filter", async () => {
    const res = await handle(setStatusRequest({ email: "steve@esa.ac", status: "added", show: "new" }), testEnv, admin);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/admin?show=new`);
    const [row] = await listSignups(testEnv.DB, "added");
    expect(row).toMatchObject({ email: "steve@esa.ac", handled_at: NOW.toISOString(), note: null });
  });

  it("marks a sign-up refused with a trimmed reason", async () => {
    await handle(setStatusRequest({ email: "steve@esa.ac", status: "refused", note: "  not an ESA student ", show: "all" }), testEnv, admin);
    const [row] = await listSignups(testEnv.DB, "refused");
    expect(row.note).toBe("not an ESA student");
  });

  it("ignores a note when marking added", async () => {
    await handle(setStatusRequest({ email: "steve@esa.ac", status: "added", note: "x" }), testEnv, admin);
    const [row] = await listSignups(testEnv.DB, "added");
    expect(row.note).toBeNull();
  });

  it("refuses a request from another site", async () => {
    const res = await handle(setStatusRequest({ email: "steve@esa.ac", status: "added" }, "https://evil.example"), testEnv, admin);
    expect(res.status).toBe(403);
    expect(await listSignups(testEnv.DB, "added")).toEqual([]);
  });

  it("refuses a request with no Origin header", async () => {
    expect((await handle(setStatusRequest({ email: "steve@esa.ac", status: "added" }, null), testEnv, admin)).status).toBe(403);
  });

  it("returns 400 for a body that is not a form", async () => {
    const req = new Request(`${ORIGIN}/admin/status`, {
      method: "POST",
      body: "{}",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    });
    expect((await handle(req, testEnv, admin)).status).toBe(400);
  });

  it("refuses an unknown status", async () => {
    expect((await handle(setStatusRequest({ email: "steve@esa.ac", status: "new" }), testEnv, admin)).status).toBe(400);
  });
});
