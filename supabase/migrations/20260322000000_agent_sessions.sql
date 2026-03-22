-- FYREN Platform — Session 12
-- Agent sessions table for serverless-compatible session management.
-- Replaces the in-memory Map<string, AgentSession> that didn't work across Vercel Lambdas.

CREATE TABLE agent_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT        UNIQUE NOT NULL,
  project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sandbox_id  TEXT        NOT NULL,
  mode        TEXT        NOT NULL CHECK (mode IN ('intake', 'build', 'iterate')),
  status      TEXT        NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error', 'closed')),
  conversation_history JSONB DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own sessions" ON agent_sessions
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = (auth.jwt() ->> 'sub')));

-- Indexes
CREATE INDEX idx_agent_sessions_session_id ON agent_sessions(session_id);
CREATE INDEX idx_agent_sessions_project_id ON agent_sessions(project_id);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER trg_agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
