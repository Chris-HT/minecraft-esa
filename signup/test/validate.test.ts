import { describe, expect, it } from "vitest";
import { passwordMatches, validateSignup, type RawForm } from "../src/validate";

const good: RawForm = {
  mc_name: "Steve_123",
  edition: "java",
  email: "student@esa.ac",
  form_group: "10B",
  consent: "yes",
};

describe("validateSignup", () => {
  it("accepts a good Java sign-up", () => {
    const r = validateSignup(good);
    expect(r).toEqual({
      ok: true,
      signup: { mcName: "Steve_123", edition: "java", email: "student@esa.ac", formGroup: "10B" },
      values: { mcName: "Steve_123", edition: "java", email: "student@esa.ac", formGroup: "10B", consent: true },
    });
  });

  it("trims and lowercases the email, trims the other fields", () => {
    const r = validateSignup({ ...good, mc_name: "  Steve  ", email: "  Student@ESA.ac ", form_group: " 10B " });
    expect(r.ok && r.signup).toEqual({ mcName: "Steve", edition: "java", email: "student@esa.ac", formGroup: "10B" });
  });

  it.each([
    ["too short", "ab"],
    ["too long (17)", "a".repeat(17)],
    ["space", "Steve Two"],
    ["symbol", "Steve!"],
  ])("refuses a Java name: %s", (_label, name) => {
    const r = validateSignup({ ...good, mc_name: name });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.mcName).toMatch(/Java name/);
  });

  it("accepts a 16-character Java name", () => {
    expect(validateSignup({ ...good, mc_name: "a".repeat(16) }).ok).toBe(true);
  });

  it.each([["Cool Gamer 42"], ["X"], ["a".repeat(16)]])("accepts the Bedrock name %j", (name) => {
    expect(validateSignup({ ...good, edition: "bedrock", mc_name: name }).ok).toBe(true);
  });

  it.each([
    ["double space", "Cool  Gamer"],
    ["underscore", "Cool_Gamer"],
    ["too long (17)", "a".repeat(17)],
  ])("refuses a Bedrock name: %s", (_label, name) => {
    const r = validateSignup({ ...good, edition: "bedrock", mc_name: name });
    expect(!r.ok && r.errors.mcName).toMatch(/Bedrock name/);
  });

  it("asks for a name when it is blank", () => {
    const r = validateSignup({ ...good, mc_name: "   " });
    expect(!r.ok && r.errors.mcName).toMatch(/Minecraft name/);
  });

  it("refuses a missing or unknown edition", () => {
    expect(!validateSignup({ ...good, edition: undefined }).ok).toBe(true);
    const r = validateSignup({ ...good, edition: "pocket" });
    expect(!r.ok && r.errors.edition).toMatch(/Java or Bedrock/);
  });

  it.each([
    ["other domain", "student@example.com"],
    ["lookalike domain", "student@esa.ac.evil.com"],
    ["subdomain", "student@mail.esa.ac"],
    ["no local part", "@esa.ac"],
    ["blank", ""],
  ])("refuses the email: %s", (_label, email) => {
    const r = validateSignup({ ...good, email });
    expect(!r.ok && r.errors.email).toMatch(/@esa\.ac/);
  });

  it("refuses an email longer than 254 characters and accepts a normal one", () => {
    const long = "a".repeat(255 - "@esa.ac".length) + "@esa.ac";
    expect(long).toHaveLength(255);
    const r = validateSignup({ ...good, email: long });
    expect(!r.ok && r.errors.email).toMatch(/@esa.ac/);
    expect(validateSignup({ ...good, email: "steve@esa.ac" }).ok).toBe(true);
  });

  it("refuses a blank or long form group", () => {
    expect(!validateSignup({ ...good, form_group: " " }).ok).toBe(true);
    const r = validateSignup({ ...good, form_group: "12345678901" });
    expect(!r.ok && r.errors.formGroup).toMatch(/form group/);
  });

  it("refuses when the box is not ticked", () => {
    const r = validateSignup({ ...good, consent: undefined });
    expect(!r.ok && r.errors.consent).toMatch(/parent or guardian/);
    expect(r.values.consent).toBe(false);
  });

  it("keeps the typed values when refusing", () => {
    const r = validateSignup({ ...good, email: "x@example.com" });
    expect(r.values).toEqual({ mcName: "Steve_123", edition: "java", email: "x@example.com", formGroup: "10B", consent: true });
  });
});

describe("passwordMatches", () => {
  it("matches the exact password", () => expect(passwordMatches("creeper42", "creeper42")).toBe(true));
  it("is case-sensitive", () => expect(passwordMatches("Creeper42", "creeper42")).toBe(false));
  it("refuses a prefix", () => expect(passwordMatches("creeper", "creeper42")).toBe(false));
  it("refuses a longer string", () => expect(passwordMatches("creeper421", "creeper42")).toBe(false));
  it("refuses everything when no password is set", () => expect(passwordMatches("", "")).toBe(false));
});
