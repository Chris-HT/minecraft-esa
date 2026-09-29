import { upsertSignup } from "./db";
import type { AppEnv } from "./env";
import { parentsPage } from "./parents";
import { formPage, thanksPage, tooManyPage } from "./pages";
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
  }
  if (method === "POST" && pathname === "/signup") return signup(request, env, deps);
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

  await upsertSignup(env.DB, result.signup, deps.now());
  return thanksPage(result.signup);
}
