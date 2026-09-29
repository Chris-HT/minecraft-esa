export const STYLE_CSS = `
:root { --bg: #f4f1ea; --card: #ffffff; --ink: #1f2a1f; --muted: #5b665b; --accent: #3c8527; --accent-ink: #ffffff; --error: #b3261e; --line: #d8d3c7; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #151a15; --card: #1f261f; --ink: #e8efe6; --muted: #a3aea1; --accent: #5dbb3f; --accent-ink: #0d140c; --error: #ff8a80; --line: #344034; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 34rem; margin: 0 auto; padding: 24px 16px 48px; }
main.wide { max-width: 72rem; }
h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 8px; }
h2 { font-size: 1.15rem; margin: 24px 0 4px; }
.tag { color: var(--muted); margin: 0 0 20px; }
.small { color: var(--muted); font-size: 0.9rem; }
form { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 20px 16px; }
label { display: block; font-weight: 600; margin: 16px 0 6px; }
label.choice { font-weight: 400; display: flex; gap: 10px; align-items: flex-start; margin: 8px 0; }
fieldset { border: 0; padding: 0; margin: 16px 0 0; }
legend { font-weight: 600; padding: 0; margin-bottom: 6px; }
input[type=text], input[type=email], input[type=password], input:not([type]) { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); }
input[type=radio], input[type=checkbox] { width: 20px; height: 20px; margin-top: 2px; flex: none; accent-color: var(--accent); }
button { font: inherit; font-weight: 600; border: 0; border-radius: 8px; padding: 12px 18px; background: var(--accent); color: var(--accent-ink); cursor: pointer; margin-top: 20px; }
button.secondary { background: transparent; color: var(--ink); border: 1px solid var(--line); margin-top: 0; padding: 6px 10px; }
.error { color: var(--error); margin: 6px 0 0; font-size: 0.95rem; }
code { background: var(--card); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }
a { color: var(--accent); }
nav { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0 16px; }
nav a[aria-current] { font-weight: 700; text-decoration: none; color: var(--ink); }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; background: var(--card); }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 0.95rem; }
td form { background: none; border: 0; padding: 0; display: flex; gap: 6px; flex-wrap: wrap; }
td form input { width: 10rem; padding: 6px 8px; }
`;

export const ADMIN_JS = `
document.addEventListener("click", async (event) => {
  const button = event.target.closest("button.copy");
  if (!button) return;
  await navigator.clipboard.writeText(button.dataset.copy);
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = "Copy"; }, 1500);
});
`;

const ASSETS: Record<string, [string, string]> = {
  "/static/style.css": [STYLE_CSS, "text/css; charset=utf-8"],
  "/static/admin.js": [ADMIN_JS, "text/javascript; charset=utf-8"],
};

export function staticAsset(pathname: string): Response | null {
  const asset = ASSETS[pathname];
  if (!asset) return null;
  return new Response(asset[0], {
    headers: { "Content-Type": asset[1], "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
