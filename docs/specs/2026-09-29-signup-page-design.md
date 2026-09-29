# Sign-up page — Design

Date: 2026-09-29
Status: designed, not built.

## Goal

Students find a poster at school, scan its QR code and sign up for the ESA
server on a small web page. Isaac, who runs the server as a student with his
parent's support, checks each sign-up and whitelists them.

- Poster: a QR code for `https://join.myminecraft.party` with the password
  printed under it. Isaac designs the poster; the QR code is supplied as a
  high-resolution PNG.
- One page, one form. A private admin page for Isaac and Chris.
- A parent note at `https://join.myminecraft.party/parents` (text in
  `signup/src/parents.ts`).

## Changes to the server design

These replace the matching points in
[2026-09-28-esa-server-design.md](2026-09-28-esa-server-design.md):

- **Who runs it.** Run by an ESA student (Isaac) with help from a parent
  (Chris), not "parent-run". Still **not a school service**, said on the page,
  the MOTD and the spawn signs.
- **Consent.** Students tick "my parent or guardian knows I'm joining and is
  OK with it". Consent is no longer collected through parents; the parent note
  is linked from the form so students can show it at home.
- **Usernames** come from the sign-up page, not from parents.

## Decisions

- **Cloudflare, not the Mac.** `myminecraft.party` is already on Cloudflare,
  it is free at this size, and nothing on the Mac faces the internet except
  Minecraft.
- **`join.myminecraft.party`, not `esa.myminecraft.party`.** `esa` is a DNS-only
  record pointing at the relay; putting a Worker on it would need Cloudflare's
  proxy and break Minecraft.
- **School email, `@esa.ac` only.** `esa.ac` is ESA's Google Workspace domain
  (checked 2026-09-29). The check shows a sign-up claims to be from ESA; it
  does not prove the student owns the address. No confirmation email: Isaac
  checks every sign-up by hand before whitelisting, and emailing children's
  school accounts adds more than it saves.
- **The password is a light gate.** Anyone who sees the poster has it. It keeps
  out bots and people who come across the address. The real gate is Isaac
  approving each sign-up.
- **No notifications at first.** Isaac checks the admin page; the thank-you
  message says "within a few days". An email alert can be added later.
- **No IP addresses stored, no tracking, no cookies** on the public page.

## The public page (`/`)

Text: "Run by an ESA student, with help from a parent. Not a school service."
No student names on the page (it is public; only the form is behind the
password).

Form fields:

| Field | Rule |
|---|---|
| Password | Must equal the `SIGNUP_PASSWORD` secret (constant-time compare) |
| Minecraft name | Java: 3–16 of `A–Z a–z 0–9 _`. Bedrock: 1–16 of letters, digits and single spaces, no leading or trailing space |
| Edition | Java (PC/Mac) or Bedrock (phone, tablet, Windows, Chromebook) |
| School email | Trimmed, lowercased, must match `^[a-z0-9._%+-]+@esa\.ac$` |
| Form group | Trimmed, 1–10 characters, e.g. `10B` |
| Tick box | "My parent or guardian knows I'm joining and is OK with it", with a link to `/parents`. Must be ticked |

All checks run in the Worker; the browser checks are only for convenience.
Errors are friendly and name the field. Submissions are limited to 20 a
minute per connection (Workers rate-limiting binding, keyed on the connecting
IP, not stored). Not lower: the school Wi-Fi puts every student behind one
address, and a class may sign up together.

After a successful sign-up: "Thanks! You'll be added within a few days. Then
join `esa.myminecraft.party`", with short join steps for Java (Multiplayer →
Add Server) and Bedrock (Servers → Add Server, port 19132), and the note that
consoles are not supported.

**Signing up again** with the same email updates that entry (name, edition,
form group) and sets it back to `new`, so a changed name is seen and
whitelisted.

## Storage (D1)

One table:

```sql
CREATE TABLE signups (
  email       TEXT PRIMARY KEY,         -- lowercased, @esa.ac
  mc_name     TEXT NOT NULL,
  edition     TEXT NOT NULL CHECK (edition IN ('java', 'bedrock')),
  form_group  TEXT NOT NULL,
  consent     INTEGER NOT NULL CHECK (consent = 1),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'added', 'refused')),
  note        TEXT,                     -- reason, when refused
  created_at  TEXT NOT NULL,            -- ISO 8601, UTC
  updated_at  TEXT NOT NULL,
  handled_at  TEXT                      -- when marked added or refused
);
```

**Deletion.** A daily Cron Trigger deletes rows marked `added` or `refused`
more than 30 days ago. By then the name is on the server's whitelist and
nothing else is needed. `new` rows are kept until someone handles them.

## The admin page (`/admin`)

- Protected by **Cloudflare Access** (Zero Trust, free up to 50 users): a
  one-time code sent to Chris's or Isaac's email. The Worker also checks the
  `Cf-Access-Jwt-Assertion` header on every `/admin` request, so the page stays
  closed if the Access policy is ever removed by mistake.
- Lists sign-ups newest first, with a filter: new / added / refused / all.
- Each row shows the command to paste into the game, with a copy button:
  - Java: `/whitelist add Name`
  - Bedrock: `/fwhitelist add Name` (Floodgate; Bedrock names must not go
    through the normal whitelist). How Floodgate takes a name with a space is
    checked on the server during the build and the command shown to match.
- Buttons: **Added**, and **Refused** with a short reason (e.g. "not an ESA
  student").
- Isaac sees classmates' school emails and form groups. That is the minimum
  needed to spot fake entries; the README tells him to keep them to himself.

## Parent note (`/parents`)

Approved 2026-09-29. Drafted in `docs/parent-note.md`; during the build it
moves into `signup/src/parents.ts` (the page's HTML), which becomes the only
copy.

## Code

```
signup/
  wrangler.jsonc               Worker, D1, rate limit, daily cron, custom domain join.myminecraft.party
  migrations/0001_signups.sql  the table above
  src/index.ts                 Worker entry: fetch() and scheduled()
  src/app.ts                   routing: /, POST /signup, /parents, /admin, POST /admin/status, /static/*
  src/validate.ts              field rules (pure functions, unit tested)
  src/db.ts                    D1 queries
  src/access.ts                Cloudflare Access JWT check
  src/html.ts, src/pages.ts, src/parents.ts, src/static.ts   HTML, CSS and the admin copy script
  test/                        Vitest with @cloudflare/vitest-plugin
```

CSS and the admin script are served under `/static/`, not `/admin…`, so the
Access rule for `/admin` never covers them.

- `deploy.sh` excludes `signup/`, so it never goes to the Mac.
- Deploy: `cd signup && npx wrangler deploy`. The password is set with
  `npx wrangler secret put SIGNUP_PASSWORD`; its value also goes in the
  1Password item "Minecraft ESA Server".
- Plain HTML and CSS, no framework, so Isaac can restyle it later.

## Testing

- Unit tests for every field rule, including edge cases (16 vs 17 characters,
  `@esa.ac.evil.com`, uppercase email, Bedrock names with spaces).
- Worker tests against a local D1: wrong password refused, good sign-up
  stored, second sign-up with the same email updates and resets to `new`,
  unticked box refused, `/admin` refused without the Access header, the cron
  deletes only old handled rows.
- By hand after deploy: scan the QR code on a phone, sign up, see it on the
  admin page, whitelist it in game, mark it added.

## Docs

- README: a "Sign-ups" section for Isaac: open the admin page, copy the
  command, mark added or refused, keep details private; and for Chris: deploy,
  change the password, add or remove admin users in Access.
- `docs/project-status.md`: the sign-up page and its state.
- Server design doc: point to this doc for the changes above.

## Open items

- The school's OK on putting posters up, asked together with the open question
  on using the ESA name and logo.
- The poster password.

Settled 2026-09-29: parents contact Chris at `me@chris-thompson.uk` (in the
parent note). Isaac's email is set only in the Cloudflare Access policy, never
in this repo, which is public.
