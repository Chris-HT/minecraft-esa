import type { Filter, SignupRow } from "./db";
import { esc, page } from "./html";
import type { Field, FormValues, Signup } from "./validate";

const WHO_RUNS_IT = `<p class="tag">Run by an ESA student, with help from a parent. Not a school service.</p>`;

export function formPage(values: FormValues = {}, errors: Partial<Record<Field, string>> = {}, status = 200): Response {
  const err = (f: Field) => (errors[f] ? `<p class="error">${esc(errors[f]!)}</p>` : "");
  const val = (v: string | undefined) => esc(v ?? "");
  const edition = (e: string) => (values.edition === e ? " checked" : "");
  return page(
    "Join the ESA Minecraft server",
    `
<h1>ESA Students' Minecraft Server</h1>
${WHO_RUNS_IT}
<p>Sign up here. A moderator checks every sign-up and adds you to the server.</p>
<form method="post" action="/signup">
  <label for="password">Password from the poster</label>
  <input id="password" name="password" type="password" autocomplete="off" required>
  ${err("password")}

  <fieldset>
    <legend>Which Minecraft do you play?</legend>
    <label class="choice"><input type="radio" name="edition" value="java"${edition("java")} required> Java (PC or Mac)</label>
    <label class="choice"><input type="radio" name="edition" value="bedrock"${edition("bedrock")}> Bedrock (phone, tablet, Windows or Chromebook)</label>
  </fieldset>
  ${err("edition")}

  <label for="mc_name">Minecraft name</label>
  <input id="mc_name" name="mc_name" type="text" value="${val(values.mcName)}" maxlength="16" autocomplete="off" required>
  ${err("mcName")}

  <label for="email">School email</label>
  <input id="email" name="email" type="email" value="${val(values.email)}" placeholder="you@esa.ac" required>
  ${err("email")}

  <label for="form_group">Form group</label>
  <input id="form_group" name="form_group" type="text" value="${val(values.formGroup)}" maxlength="10" placeholder="e.g. 10B" required>
  ${err("formGroup")}

  <label class="choice"><input type="checkbox" name="consent" value="yes"${values.consent ? " checked" : ""} required>
    <span>My parent or guardian knows I'm joining and is OK with it. (<a href="/parents">Note for parents</a>)</span></label>
  ${err("consent")}

  <button type="submit">Sign up</button>
</form>
<p class="small">Xbox, PlayStation and Switch can't join. Questions? Ask a moderator in game, or see the <a href="/parents">note for parents</a>.</p>
`,
    { status },
  );
}

export function thanksPage(s: Signup): Response {
  return page(
    "Thanks for signing up",
    `
<h1>Thanks, ${esc(s.mcName)}!</h1>
${WHO_RUNS_IT}
<p>You'll be added within a few days. Then join:</p>
<h2>Java (PC or Mac)</h2>
<ol><li>Multiplayer, then Add Server.</li><li>Server address: <code>esa.myminecraft.party</code></li></ol>
<h2>Bedrock (phone, tablet, Windows or Chromebook)</h2>
<ol><li>Play, then Servers, then Add Server.</li><li>Server address: <code>esa.myminecraft.party</code>, port <code>19132</code></li></ol>
<p class="small">Used the wrong name? Fill in the <a href="/">form</a> again with the same school email.</p>
`,
  );
}

export function tooManyPage(): Response {
  return page(
    "Too many tries",
    `<h1>Too many tries</h1><p>Lots of sign-ups have come from this connection in the last minute. Wait a minute, then <a href="/">try again</a>.</p>`,
    { status: 429 },
  );
}

/** The command to type in game. Bedrock players go through Floodgate's whitelist. */
export function whitelistCommand(row: Pick<SignupRow, "mc_name" | "edition">): string {
  if (row.edition === "java") return `/whitelist add ${row.mc_name}`;
  return row.mc_name.includes(" ") ? `/fwhitelist add "${row.mc_name}"` : `/fwhitelist add ${row.mc_name}`;
}

const FILTERS: [Filter, string][] = [["new", "New"], ["added", "Added"], ["refused", "Refused"], ["all", "All"]];

export function adminPage(rows: SignupRow[], filter: Filter, adminEmail: string): Response {
  const nav = FILTERS.map(([f, label]) =>
    `<a href="/admin?show=${f}"${f === filter ? ' aria-current="page"' : ""}>${label}</a>`,
  ).join("");
  const body = rows.length === 0
    ? "<p>Nothing here.</p>"
    : `<div class="table-wrap"><table>
<thead><tr><th>Name</th><th>Edition</th><th>Form</th><th>Email</th><th>Signed up</th><th>Status</th><th>Command</th><th>Mark as</th></tr></thead>
<tbody>
${rows.map((r) => adminRow(r, filter)).join("\n")}
</tbody></table></div>`;
  const main = `
<h1>Sign-ups</h1>
<p class="small">Signed in as ${esc(adminEmail)}. These are other students' details: keep them to yourself.</p>
<nav>${nav}</nav>
${body}
<p class="small">Copy the command, paste it into the game chat, then mark the sign-up as added.</p>`;
  return page("Sign-ups", main, { script: "/static/admin.js", wide: true });
}

function adminRow(r: SignupRow, filter: Filter): string {
  const cmd = whitelistCommand(r);
  const hidden = `<input type="hidden" name="email" value="${esc(r.email)}"><input type="hidden" name="show" value="${filter}">`;
  const status = r.status === "refused" && r.note ? `refused: ${esc(r.note)}` : r.status;
  return `<tr>
<td>${esc(r.mc_name)}</td>
<td>${r.edition === "java" ? "Java" : "Bedrock"}</td>
<td>${esc(r.form_group)}</td>
<td>${esc(r.email)}</td>
<td>${esc(r.updated_at.slice(0, 16).replace("T", " "))}</td>
<td>${status}</td>
<td><code>${esc(cmd)}</code> <button type="button" class="copy secondary" data-copy="${esc(cmd)}">Copy</button></td>
<td>
  <form method="post" action="/admin/status">${hidden}<input type="hidden" name="status" value="added"><button class="secondary">Added</button></form>
  <form method="post" action="/admin/status">${hidden}<input type="hidden" name="status" value="refused"><input name="note" type="text" maxlength="200" placeholder="Reason"><button class="secondary">Refused</button></form>
</td>
</tr>`;
}
