import { describe, expect, it } from "vitest";
import type { SignupRow } from "../src/db";
import { esc } from "../src/html";
import { parentsPage } from "../src/parents";
import { adminPage, errorPage, formPage, thanksPage, tooManyPage, whitelistCommand } from "../src/pages";
import { staticAsset } from "../src/static";

const row: SignupRow = {
  email: "steve@esa.ac", mc_name: "Steve", edition: "java", form_group: "10B",
  status: "new", note: null, created_at: "2026-10-01T09:00:00.000Z",
  updated_at: "2026-10-01T09:00:00.000Z", handled_at: null,
};

describe("esc", () => {
  it("escapes HTML special characters", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("formPage", () => {
  it("says who runs it and never names a student", async () => {
    const html = await formPage().text();
    expect(html).toContain("Run by an ESA student, with help from a parent. Not a school service.");
    expect(html).not.toMatch(/Isaac|Wheafus/);
  });

  it("sends security headers and no cookies", () => {
    const res = formPage();
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("keeps the Origin header on same-site form posts", () => {
    // no-referrer would make browsers send "Origin: null" and /admin/status would refuse it.
    expect(formPage().headers.get("Referrer-Policy")).toBe("same-origin");
  });

  it("re-fills typed values (escaped) but never the password, and shows errors", async () => {
    const res = formPage({ mcName: `<b>`, email: "x@example.com", edition: "bedrock", consent: true }, { email: "Use your school email, ending in @esa.ac." }, 400);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('value="&lt;b&gt;"');
    expect(html).toContain('value="x@example.com"');
    expect(html).toMatch(/value="bedrock" checked/);
    expect(html).toContain("Use your school email, ending in @esa.ac.");
    expect(html).not.toMatch(/name="password"[^>]*value=/);
  });

  it("turns off phone auto-capitalise and correction on the name and email, and caps the email length", async () => {
    const html = await formPage().text();
    expect(html).toMatch(/<input id="mc_name"[^>]*autocapitalize="off"[^>]*autocorrect="off"[^>]*spellcheck="false"/);
    expect(html).toMatch(/<input id="email"[^>]*autocapitalize="off"[^>]*autocorrect="off"[^>]*spellcheck="false"/);
    expect(html).toMatch(/<input id="email"[^>]*maxlength="254"/);
    expect(html).toMatch(/<input id="form_group"[^>]*autocapitalize="characters"/);
  });

  it("links the tick box to the parent note", async () => {
    const html = await formPage().text();
    expect(html).toContain("My parent or guardian knows I'm joining and is OK with it");
    expect(html).toContain('href="/parents"');
  });
});

describe("thanksPage", () => {
  it("gives join steps for both editions", async () => {
    const html = await thanksPage({ mcName: "Steve<", edition: "java", email: "s@esa.ac", formGroup: "10B" }).text();
    expect(html).toContain("Steve&lt;");
    expect(html).toContain("esa.myminecraft.party");
    expect(html).toContain("19132");
  });

  it("says the consoles cannot join", async () => {
    const html = await thanksPage({ mcName: "Steve", edition: "java", email: "s@esa.ac", formGroup: "10B" }).text();
    expect(html).toContain("Xbox");
  });
});

describe("errorPage", () => {
  it("is a friendly 503", async () => {
    const res = errorPage();
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("Something went wrong saving your sign-up. Please try again in a few minutes.");
  });
});

describe("tooManyPage", () => {
  it("is a 429", () => expect(tooManyPage().status).toBe(429));
});

describe("parentsPage", () => {
  it("has the contact address and retention facts", async () => {
    const html = await parentsPage().text();
    expect(html).toContain("me@chris-thompson.uk");
    expect(html).toContain("about 6 weeks at most");
    expect(html).toContain("Not run by the school");
  });
});

describe("whitelistCommand", () => {
  it("uses /whitelist for Java", () => expect(whitelistCommand({ mc_name: "Steve", edition: "java" })).toBe("/whitelist add Steve"));
  it("uses /fwhitelist for Bedrock", () => expect(whitelistCommand({ mc_name: "Alex", edition: "bedrock" })).toBe("/fwhitelist add Alex"));
  it("quotes a Bedrock name with a space", () =>
    expect(whitelistCommand({ mc_name: "Cool Gamer", edition: "bedrock" })).toBe('/fwhitelist add "Cool Gamer"'));
});

describe("adminPage", () => {
  it("lists rows with the command, escaped, and status buttons", async () => {
    const html = await adminPage([{ ...row, mc_name: "Steve", form_group: "<i>" }], "new", "chris@example.com").text();
    expect(html).toContain("/whitelist add Steve");
    expect(html).toContain("&lt;i&gt;");
    expect(html).toContain('action="/admin/status"');
    expect(html).toContain('name="status" value="added"');
    expect(html).toContain('name="status" value="refused"');
    expect(html).toContain("/static/admin.js");
  });

  it("marks an entry that was changed by signing up again", async () => {
    const changed = await adminPage([{ ...row, updated_at: "2026-10-02T09:00:00.000Z" }], "new", "chris@example.com").text();
    expect(changed).toContain("<strong");
    expect(changed).toContain(">changed</strong>");
    const same = await adminPage([row], "new", "chris@example.com").text();
    expect(same).not.toContain(">changed<");
  });

  it("says when there is nothing to show", async () => {
    expect(await adminPage([], "new", "chris@example.com").text()).toContain("Nothing here.");
  });

  it("is never cached", () => {
    expect(adminPage([], "all", "a@b").headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("staticAsset", () => {
  it("serves the stylesheet and admin script", async () => {
    expect(staticAsset("/static/style.css")?.headers.get("Content-Type")).toBe("text/css; charset=utf-8");
    expect(staticAsset("/static/admin.js")?.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(staticAsset("/static/nope.css")).toBeNull();
  });
});
