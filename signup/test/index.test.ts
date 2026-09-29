import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { AppEnv } from "../src/env";

const appEnv = env as unknown as AppEnv;

describe("worker", () => {
  it("serves the form", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("https://join.myminecraft.party/"), appEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
  });

  it("keeps /admin closed while Access is not configured", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(
      new Request("https://join.myminecraft.party/admin", { headers: { "Cf-Access-Jwt-Assertion": "a.b.c" } }),
      appEnv,
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("purges old handled rows on the schedule", async () => {
    await env.DB.exec("DELETE FROM signups");
    await env.DB.prepare(
      "INSERT INTO signups (email, mc_name, edition, form_group, consent, status, created_at, updated_at, handled_at) VALUES ('old@esa.ac', 'Old', 'java', '10B', 1, 'added', '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', '2020-01-02T00:00:00.000Z')",
    ).run();
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ scheduledTime: new Date(), cron: "0 3 * * *" }), appEnv);
    await waitOnExecutionContext(ctx);
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM signups").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
