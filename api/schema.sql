CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  challenge TEXT NOT NULL,
  left_model TEXT NOT NULL,
  right_model TEXT NOT NULL,
  left_score REAL,
  right_score REAL,
  winner TEXT NOT NULL,
  elo_delta INTEGER,
  anonymous_id TEXT,
  integrity_hash TEXT,
  raw_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratings (
  model TEXT PRIMARY KEY,
  elo INTEGER DEFAULT 1200,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  total_battles INTEGER DEFAULT 0,
  last_updated TEXT
);

CREATE INDEX IF NOT EXISTS idx_battles_timestamp ON battles(timestamp);
CREATE INDEX IF NOT EXISTS idx_battles_models ON battles(left_model, right_model);
CREATE INDEX IF NOT EXISTS idx_battles_anonymous ON battles(anonymous_id);
