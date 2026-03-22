-- FYREN Platform — Agent events table for cross-Lambda SSE polling
-- Replaces Supabase Realtime broadcast (WebSockets don't work in Vercel serverless)

CREATE TABLE agent_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  event JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_events_session ON agent_events(session_id, id);

-- No RLS needed — accessed only via service role in API routes
