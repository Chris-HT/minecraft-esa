/** Bindings and settings the Worker receives (see wrangler.jsonc). */
export interface AppEnv {
  DB: D1Database;
  SIGNUP_LIMIT: RateLimit;
  /** Secret: the password printed on the poster. */
  SIGNUP_PASSWORD: string;
  /** e.g. https://<team>.cloudflareaccess.com; empty until Access is set up. */
  ACCESS_TEAM_DOMAIN: string;
  /** Audience tag of the Access application protecting /admin. */
  ACCESS_AUD: string;
}
