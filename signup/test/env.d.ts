declare namespace Cloudflare {
  interface Env {
    /** Test-only: migrations read by vitest.config.ts. */
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
