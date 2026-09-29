import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { handle, type Deps } from "../src/app";
import { listSignups } from "../src/db";
import type { AppEnv } from "../src/env";

const NOW = new Date("2026-10-01T09:00:00.000Z");
let limiterAllows = true;
const testEnv: AppEnv = {
  DB: env.DB,
  SIGNUP_LIMIT: { limit: async () => ({ success: limiterAllows }) } as RateLimit,
  SIGNUP_PASSWORD: "creeper42",
  ACCESS_TEAM_DOMAIN: "",
  ACCESS_AUD: "",
};
const deps: Deps = { adminEmail: async () => null, now: () => NOW };

const ORIGIN = "https://join.myminecraft.party";
const good = { password: "creeper42", mc_name: "Steve", edition: "java", email: "steve@esa.ac", form_group: "10B", consent: "yes" };
const post = (fields: Record<string, string>) =>
  handle(new Request(`${ORIGIN}/signup`, { method: "POST", body: new URLSearchParams(fields) }), testEnv, deps);
const get = (path: string) => handle(new Request(`${ORIGIN}${path}`), testEnv, deps);

beforeEach(async () => {
  limiterAllows = true;
  await env.DB.exec("DELETE FROM signups");
});

describe("GET pages", () => {
  it("serves the form", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('action="/signup"');
  });
  it("serves the parent note", async () => expect((await get("/parents")).status).toBe(200));
  it("serves the stylesheet", async () => expect((await get("/static/style.css")).status).toBe(200));
  it("404s anything else", async () => expect((await get("/nope")).status).toBe(404));
});

describe("POST /signup", () => {
  it("stores a good sign-up and thanks the student", async () => {
    const res = await post(good);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Thanks, Steve!");
    const rows = await listSignups(env.DB, "new");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "steve@esa.ac", mc_name: "Steve", created_at: NOW.toISOString() });
  });

  it("refuses a wrong password and stores nothing", async () => {
    const res = await post({ ...good, password: "nope" });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("not the password on the poster");
    expect(await listSignups(env.DB, "all")).toEqual([]);
  });

  it("shows field errors and keeps what was typed", async () => {
    const res = await post({ ...good, email: "steve@gmail.com" });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("ending in @esa.ac");
    expect(html).toContain('value="steve@gmail.com"');
    expect(await listSignups(env.DB, "all")).toEqual([]);
  });

  it("refuses when the box is not ticked", async () => {
    const { consent: _omit, ...noConsent } = good;
    expect((await post(noConsent)).status).toBe(400);
    expect(await listSignups(env.DB, "all")).toEqual([]);
  });

  it("updates rather than duplicates the same email", async () => {
    await post(good);
    await post({ ...good, mc_name: "Steve2" });
    const rows = await listSignups(env.DB, "all");
    expect(rows.map((r) => r.mc_name)).toEqual(["Steve2"]);
  });

  it("returns 429 when the rate limit is hit, before checking anything", async () => {
    limiterAllows = false;
    const res = await post(good);
    expect(res.status).toBe(429);
    expect(await listSignups(env.DB, "all")).toEqual([]);
  });

  it("refuses everything when no password has been set", async () => {
    const res = await handle(
      new Request(`${ORIGIN}/signup`, { method: "POST", body: new URLSearchParams(good) }),
      { ...testEnv, SIGNUP_PASSWORD: "" },
      deps,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a body that is not a form", async () => {
    const res = await handle(
      new Request(`${ORIGIN}/signup`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }),
      testEnv,
      deps,
    );
    expect(res.status).toBe(400);
  });
});
