const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

export function page(
  title: string,
  body: string,
  opts: { status?: number; script?: string; wide?: boolean } = {},
): Response {
  const script = opts.script ? `<script src="${esc(opts.script)}" defer></script>` : "";
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/static/style.css">
${script}
</head>
<body><main${opts.wide ? ' class="wide"' : ""}>
${body}
</main></body>
</html>`;
  return new Response(html, {
    status: opts.status ?? 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
  });
}
