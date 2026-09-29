import type { Edition, Signup } from "./validate";

export type Status = "new" | "added" | "refused";
export type Filter = Status | "all";

export interface SignupRow {
  email: string;
  mc_name: string;
  edition: Edition;
  form_group: string;
  status: Status;
  note: string | null;
  created_at: string;
  updated_at: string;
  handled_at: string | null;
}

const KEEP_HANDLED_DAYS = 30;

export function parseFilter(value: string | null): Filter {
  return value === "added" || value === "refused" || value === "all" ? value : "new";
}

/** Insert, or update the same email and put it back in the "new" pile. */
export async function upsertSignup(db: D1Database, s: Signup, now: Date): Promise<void> {
  await db
    .prepare(
      `INSERT INTO signups (email, mc_name, edition, form_group, consent, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 1, 'new', ?5, ?5)
       ON CONFLICT (email) DO UPDATE SET
         mc_name = excluded.mc_name, edition = excluded.edition, form_group = excluded.form_group,
         status = 'new', note = NULL, updated_at = excluded.updated_at, handled_at = NULL`,
    )
    .bind(s.email, s.mcName, s.edition, s.formGroup, now.toISOString())
    .run();
}

export async function listSignups(db: D1Database, filter: Filter): Promise<SignupRow[]> {
  const stmt =
    filter === "all"
      ? db.prepare("SELECT * FROM signups ORDER BY updated_at DESC")
      : db.prepare("SELECT * FROM signups WHERE status = ?1 ORDER BY updated_at DESC").bind(filter);
  return (await stmt.all<SignupRow>()).results;
}

export async function setStatus(
  db: D1Database,
  email: string,
  status: "added" | "refused",
  note: string | null,
  now: Date,
): Promise<boolean> {
  const r = await db
    .prepare("UPDATE signups SET status = ?2, note = ?3, handled_at = ?4 WHERE email = ?1")
    .bind(email, status, note, now.toISOString())
    .run();
  return r.meta.changes > 0;
}

/** Delete rows marked added or refused more than 30 days ago. */
export async function purgeHandled(db: D1Database, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - KEEP_HANDLED_DAYS * 86_400_000).toISOString();
  const r = await db
    .prepare("DELETE FROM signups WHERE status IN ('added', 'refused') AND handled_at < ?1")
    .bind(cutoff)
    .run();
  return r.meta.changes;
}
