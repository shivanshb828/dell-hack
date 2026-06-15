-- Donna voice_agent — idempotent schema for better-sqlite3
-- Owned tables prefixed with voice_ to avoid collision with Python donna/ schema.

CREATE TABLE IF NOT EXISTS voice_call_sessions (
  call_sid TEXT PRIMARY KEY,
  caller_phone TEXT,
  mode TEXT NOT NULL DEFAULT 'inbound',
  lead_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  incident_type TEXT,
  incident_date TEXT,
  incident_location TEXT,
  injury_summary TEXT,
  consent_recording INTEGER DEFAULT 0,
  consent_ai_disclosure INTEGER DEFAULT 0,
  consent_intake INTEGER DEFAULT 0,
  additional_context TEXT,
  outcome TEXT
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_phone ON voice_call_sessions(caller_phone);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_call_sessions(status);

CREATE TABLE IF NOT EXISTS voice_leads (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  incident_type TEXT,
  incident_summary TEXT,
  status TEXT DEFAULT 'new',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_voice_leads_phone ON voice_leads(phone);

CREATE TABLE IF NOT EXISTS voice_call_events (
  call_sid TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  PRIMARY KEY (call_sid, seq)
);

CREATE INDEX IF NOT EXISTS idx_voice_events_callsid ON voice_call_events(call_sid);

CREATE TABLE IF NOT EXISTS voice_appointments (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  call_sid TEXT,
  datetime_iso TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  attorney TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
