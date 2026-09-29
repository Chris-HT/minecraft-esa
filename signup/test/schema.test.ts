import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("signups table", () => {
  it("exists after migrations", async () => {
    const row = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'signups'")
      .first<{ name: string }>();
    expect(row?.name).toBe("signups");
  });

  it("refuses a row without consent", async () => {
    const insert = env.DB
      .prepare(
        "INSERT INTO signups (email, mc_name, edition, form_group, consent, created_at, updated_at) VALUES ('a@esa.ac', 'Steve', 'java', '10B', 0, 'x', 'x')",
      )
      .run();
    await expect(insert).rejects.toThrow(/CHECK constraint/);
  });
});
