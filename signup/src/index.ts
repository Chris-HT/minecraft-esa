import type { AppEnv } from "./env";

export default {
  async fetch(): Promise<Response> {
    return new Response("Not built yet", { status: 503 });
  },
} satisfies ExportedHandler<AppEnv>;
