import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { listSignups, parseFilter, purgeHandled, setStatus, upsertSignup } from "../src/db";
import type { Signup } from "../src/validate";

const steve: Signup = { mcName: "Steve", edition: "java", email: "steve@esa.ac", formGroup: "10B" };
const alex: Signup = { mcName: "Alex Two", edition: "bedrock", email: "alex@esa.ac", formGroup: "11C" };
const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n));

beforeEach(async () => {
  await env.DB.exec("DELETE FROM signups");
});

describe("upsertSignup", () => {
  it("stores a new sign-up as new, with consent", async () => {
    await upsertSignup(env.DB, steve, day(0));
    const [row] = await listSignups(env.DB, "all");
    expect(row).toMatchObject({
      email: "steve@esa.ac", mc_name: "Steve", edition: "java", form_group: "10B",
      status: "new", note: null, created_at: day(0).toISOString(), updated_at: day(0).toISOString(), handled_at: null,
    });
  });

  it("updates the same email and sets it back to new", async () => {
    await upsertSignup(env.DB, steve, day(0));
    await setStatus(env.DB, "steve@esa.ac", "refused", "typo", day(1));
    await upsertSignup(env.DB, { ...steve, mcName: "Steve2" }, day(2));
    const rows = await listSignups(env.DB, "all");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mc_name: "Steve2", status: "new", note: null, handled_at: null,
      created_at: day(0).toISOString(), updated_at: day(2).toISOString(),
    });
  });
});

describe("listSignups", () => {
  it("filters by status and puts the newest first", async () => {
    await upsertSignup(env.DB, steve, day(0));
    await upsertSignup(env.DB, alex, day(1));
    await setStatus(env.DB, "steve@esa.ac", "added", null, day(2));
    expect((await listSignups(env.DB, "new")).map((r) => r.email)).toEqual(["alex@esa.ac"]);
    expect((await listSignups(env.DB, "added")).map((r) => r.email)).toEqual(["steve@esa.ac"]);
    expect((await listSignups(env.DB, "refused"))).toEqual([]);
    expect((await listSignups(env.DB, "all")).map((r) => r.email)).toEqual(["alex@esa.ac", "steve@esa.ac"]);
  });
});

describe("setStatus", () => {
  it("records the status, note and time", async () => {
    await upsertSignup(env.DB, steve, day(0));
    expect(await setStatus(env.DB, "steve@esa.ac", "refused", "not an ESA student", day(3))).toBe(true);
    const [row] = await listSignups(env.DB, "refused");
    expect(row).toMatchObject({ status: "refused", note: "not an ESA student", handled_at: day(3).toISOString(), updated_at: day(0).toISOString() });
  });

  it("returns false for an unknown email", async () => {
    expect(await setStatus(env.DB, "nobody@esa.ac", "added", null, day(0))).toBe(false);
  });
});

describe("purgeHandled", () => {
  it("deletes only rows handled more than 30 days ago", async () => {
    await upsertSignup(env.DB, steve, day(0));
    await upsertSignup(env.DB, alex, day(0));
    await upsertSignup(env.DB, { ...steve, email: "old-new@esa.ac" }, day(0));
    await setStatus(env.DB, "steve@esa.ac", "added", null, day(1));
    await setStatus(env.DB, "alex@esa.ac", "refused", "x", day(20));
    expect(await purgeHandled(env.DB, day(40))).toBe(1);
    expect((await listSignups(env.DB, "all")).map((r) => r.email).sort()).toEqual(["alex@esa.ac", "old-new@esa.ac"]);
  });
});

describe("parseFilter", () => {
  it.each([["added", "added"], ["refused", "refused"], ["all", "all"], ["new", "new"], [null, "new"], ["junk", "new"]] as const)(
    "%s -> %s",
    (input, expected) => expect(parseFilter(input)).toBe(expected),
  );
});
