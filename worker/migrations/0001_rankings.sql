CREATE TABLE IF NOT EXISTS rankings (
  run_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
  time INTEGER NOT NULL,
  client TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ranking_daily ON rankings(category, day, score DESC, time);
CREATE INDEX IF NOT EXISTS ranking_rate ON rankings(client, time);
