-- Sign-ups from join.myminecraft.party. Rows marked added or refused are
-- deleted 30 days after handled_at by the daily cron.
CREATE TABLE signups (
  email       TEXT PRIMARY KEY,
  mc_name     TEXT NOT NULL,
  edition     TEXT NOT NULL CHECK (edition IN ('java', 'bedrock')),
  form_group  TEXT NOT NULL,
  consent     INTEGER NOT NULL CHECK (consent = 1),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'added', 'refused')),
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  handled_at  TEXT
);
