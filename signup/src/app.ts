import { listSignups, parseFilter, setStatus, upsertSignup } from "./db";
import type { AppEnv } from "./env";
import { parentsPage } from "./parents";
import { adminPage, errorPage, formPage, thanksPage, tooManyPage } from "./pages";
import { staticAsset } from "./static";
import { passwordMatches, validateSignup, type RawForm } from "./validate";

export interface Deps {
  /** Email of a verified admin, or null. */
  adminEmail(request: Request, env: AppEnv): Promise<string | null>;
  now(): Date;
}

const notFound = () => new Response("Not found", { status: 404 });

export async function handle(request: Request, env: AppEnv, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === "GET") {
    const asset = staticAsset(pathname);
    if (asset) return asset;
    if (pathname === "/") return formPage();
    if (pathname === "/parents") return parentsPage();
    if (pathname === "/signup") return Response.redirect(`${url.origin}/`, 303);
  }
  if (method === "POST" && pathname === "/signup") return signup(request, env, deps);
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return admin(request, env, deps, url);
  return notFound();
}

async function signup(request: Request, env: AppEnv, deps: Deps): Promise<Response> {
  // Keyed on the connecting IP, which is used here and never stored.
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.SIGNUP_LIMIT.limit({ key: `signup:${ip}` });
  if (!success) return tooManyPage();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return formPage({}, {}, 400);
  }
  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const raw: RawForm = {
    mc_name: field("mc_name"),
    edition: field("edition"),
    email: field("email"),
    form_group: field("form_group"),
    consent: field("consent"),
  };

  const result = validateSignup(raw);
  const passwordOk = passwordMatches(field("password") ?? "", env.SIGNUP_PASSWORD ?? "");
  if (!result.ok || !passwordOk) {
    const errors = result.ok ? {} : { ...result.errors };
    if (!passwordOk) errors.password = "That's not the password on the poster.";
    return formPage(result.values, errors, 400);
  }

  try {
    await upsertSignup(env.DB, result.signup, deps.now());
  } catch {
    return errorPage();
  }
  return thanksPage(result.signup);
}

const forbidden = () => new Response("Forbidden", { status: 403 });

async function admin(request: Request, env: AppEnv, deps: Deps, url: URL): Promise<Response> {
  const email = await deps.adminEmail(request, env);
  if (!email) return forbidden();

  if (request.method === "GET" && url.pathname === "/admin") {
    const filter = parseFilter(url.searchParams.get("show"));
    return adminPage(await listSignups(env.DB, filter), filter, email);
  }

  if (request.method === "POST" && url.pathname === "/admin/status") {
    // Browsers send Origin on form posts; anything else did not come from this page.
    if (request.headers.get("Origin") !== url.origin) return forbidden();
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const status = form.get("status");
    if (status !== "added" && status !== "refused") return new Response("Bad request", { status: 400 });
    const target = String(form.get("email") ?? "");
    const note = status === "refused" ? String(form.get("note") ?? "").trim().slice(0, 200) || null : null;
    await setStatus(env.DB, target, status, note, deps.now());
    const back = parseFilter(String(form.get("show") ?? "new"));
    return Response.redirect(`${url.origin}/admin?show=${back}`, 303);
  }

  return notFound();
}
