import { verifyAccess } from "./access";
import { handle } from "./app";
import { purgeHandled } from "./db";
import type { AppEnv } from "./env";

export default {
  fetch(request, env): Promise<Response> {
    return handle(request, env, { adminEmail: verifyAccess, now: () => new Date() });
  },

  /** Daily: delete sign-ups handled more than 30 days ago. */
  async scheduled(_controller, env): Promise<void> {
    await purgeHandled(env.DB, new Date());
  },
} satisfies ExportedHandler<AppEnv>;
