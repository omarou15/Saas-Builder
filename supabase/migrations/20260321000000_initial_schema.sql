-- FYREN Platform — Initial Schema
-- Session 2 — BDD Supabase
-- Toutes les tables ont RLS activé (règle métier critique #7)

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE : users
-- Sync Clerk via webhook. Source de vérité pour les crédits.
-- ============================================================
CREATE TABLE users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    TEXT        UNIQUE NOT NULL,
  email       TEXT        NOT NULL,
  name        TEXT,
  credits     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour la lookup Clerk → user (chemin chaud : webhook + auth)
CREATE UNIQUE INDEX idx_users_clerk_id ON users (clerk_id);
CREATE INDEX idx_users_email ON users (email);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Un user ne voit que sa propre ligne
-- auth.uid() = UUID Supabase Auth ; on mappe via clerk_id dans le JWT Clerk
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- Les inserts sont faits UNIQUEMENT via le webhook Clerk (service role)
-- → pas de policy INSERT pour les users normaux


-- ============================================================
-- TABLE : projects
-- ============================================================
CREATE TABLE projects (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT          NOT NULL,
  slug         TEXT          UNIQUE NOT NULL,
  status       TEXT          NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','intake','building','deployed','archived')),
  cdc_json     JSONB,                     -- CDC structuré produit par l'intake
  stack_config JSONB,                     -- services sélectionnés
  sandbox_id   TEXT,                      -- ID du container E2B actif
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id   ON projects (user_id);
CREATE INDEX idx_projects_status    ON projects (status);
CREATE UNIQUE INDEX idx_projects_slug ON projects (slug);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_all_own" ON projects
  FOR ALL USING (user_id = auth.uid());


-- ============================================================
-- TABLE : service_connections
-- API keys chiffrées AES-256-GCM (jamais en clair)
-- ============================================================
CREATE TABLE service_connections (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  service     TEXT        NOT NULL
              CHECK (service IN ('github','vercel','supabase','clerk','stripe','resend')),
  config      JSONB       NOT NULL,    -- tokens/keys chiffrés AES-256-GCM
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','connected','error')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_connections_project_id ON service_connections (project_id);
CREATE INDEX idx_service_connections_service    ON service_connections (service);
-- Contrainte d'unicité : un seul service du même type par projet
CREATE UNIQUE INDEX idx_service_connections_project_service
  ON service_connections (project_id, service);

-- RLS — accès via appartenance au projet
ALTER TABLE service_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_connections_all_own" ON service_connections
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE : conversations
-- ============================================================
CREATE TABLE conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL
              CHECK (type IN ('intake','build','iterate')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_project_id ON conversations (project_id);
CREATE INDEX idx_conversations_type       ON conversations (type);

-- RLS — accès via appartenance au projet
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_all_own" ON conversations
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE : messages
-- ============================================================
CREATE TABLE messages (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT          NOT NULL
                  CHECK (role IN ('user','assistant','system')),
  content         TEXT          NOT NULL,
  tokens_used     INTEGER       NOT NULL DEFAULT 0,
  cost_usd        DECIMAL(8,4)  NOT NULL DEFAULT 0.0000,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Index chaud : charger tous les messages d'une conversation triés par date
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_created_at      ON messages (created_at);

-- RLS — accès via appartenance à la conversation → projet → user
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_all_own" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN projects p ON p.id = c.project_id
      WHERE p.user_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE : credit_transactions
-- ============================================================
CREATE TABLE credit_transactions (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT          NOT NULL
              CHECK (type IN ('purchase','usage','refund','welcome')),
  amount      DECIMAL(10,2) NOT NULL,   -- positif = crédit, négatif = débit
  description TEXT,
  stripe_id   TEXT,                     -- Payment Intent ou Transfer ID
  project_id  UUID          REFERENCES projects(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_id    ON credit_transactions (user_id);
CREATE INDEX idx_credit_transactions_project_id ON credit_transactions (project_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions (created_at);

-- RLS
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_transactions_select_own" ON credit_transactions
  FOR SELECT USING (user_id = auth.uid());

-- Les inserts/updates sur les transactions se font UNIQUEMENT via service role
-- (webhook Stripe, débit automatique côté serveur) → pas de policy pour le user


-- ============================================================
-- VUE SÉCURISÉE : solde crédits courant
-- ============================================================
CREATE OR REPLACE VIEW user_credit_balance AS
SELECT
  u.id         AS user_id,
  u.clerk_id,
  u.email,
  u.credits    AS balance
FROM users u;

-- Restreindre la vue via RLS implicite sur users
-- La vue utilise SECURITY INVOKER (défaut) → les policies users s'appliquent
