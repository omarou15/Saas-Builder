-- FYREN Platform — Session 3
-- Fix RLS policies to be compatible with Clerk JWTs
--
-- Context: Clerk JWTs have sub = clerk_id (e.g. "user_xxxxx"), NOT a UUID.
-- Supabase's auth.uid() casts sub to UUID — returns NULL for Clerk IDs.
-- Fix: use (auth.jwt() ->> 'sub') directly (TEXT comparison via clerk_id).
--
-- PREREQUISITE: Supabase project must be configured to accept Clerk JWTs.
-- See: https://clerk.com/docs/integrations/databases/supabase
-- Dashboard → Project Settings → Auth → JWT Secret → paste Clerk JWKS URL
-- OR: Add Clerk as a "Third-party auth" provider in Supabase dashboard.

-- ============================================================
-- TABLE : users
-- ============================================================
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

-- auth.jwt() ->> 'sub' = Clerk user ID (TEXT, not UUID)
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (clerk_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (clerk_id = (auth.jwt() ->> 'sub'));


-- ============================================================
-- TABLE : projects
-- ============================================================
DROP POLICY IF EXISTS "projects_all_own" ON projects;

CREATE POLICY "projects_all_own" ON projects
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = (auth.jwt() ->> 'sub')
    )
  );


-- ============================================================
-- TABLE : service_connections
-- ============================================================
DROP POLICY IF EXISTS "service_connections_all_own" ON service_connections;

CREATE POLICY "service_connections_all_own" ON service_connections
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN users u ON u.id = p.user_id
      WHERE u.clerk_id = (auth.jwt() ->> 'sub')
    )
  );


-- ============================================================
-- TABLE : conversations
-- ============================================================
DROP POLICY IF EXISTS "conversations_all_own" ON conversations;

CREATE POLICY "conversations_all_own" ON conversations
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN users u ON u.id = p.user_id
      WHERE u.clerk_id = (auth.jwt() ->> 'sub')
    )
  );


-- ============================================================
-- TABLE : messages
-- ============================================================
DROP POLICY IF EXISTS "messages_all_own" ON messages;

CREATE POLICY "messages_all_own" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN projects p ON p.id = c.project_id
      JOIN users u ON u.id = p.user_id
      WHERE u.clerk_id = (auth.jwt() ->> 'sub')
    )
  );


-- ============================================================
-- TABLE : credit_transactions
-- ============================================================
DROP POLICY IF EXISTS "credit_transactions_select_own" ON credit_transactions;

CREATE POLICY "credit_transactions_select_own" ON credit_transactions
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = (auth.jwt() ->> 'sub')
    )
  );


-- ============================================================
-- FUNCTION : deduct_credits (atomique)
-- Utilisée par les API routes pour débiter les crédits.
-- SECURITY DEFINER = tourne avec les droits du créateur (service role).
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id    UUID,
  p_amount     DECIMAL(10,2),
  p_description TEXT,
  p_project_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérification du solde (atomique : lock la ligne)
  IF (SELECT credits FROM users WHERE id = p_user_id FOR UPDATE) < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits: solde insuffisant (requis: %, disponible: %)',
      p_amount,
      (SELECT credits FROM users WHERE id = p_user_id);
  END IF;

  -- Débit du solde
  UPDATE users
    SET credits = credits - p_amount
    WHERE id = p_user_id;

  -- Insertion de la transaction
  INSERT INTO credit_transactions (user_id, type, amount, description, project_id)
    VALUES (p_user_id, 'usage', -p_amount, p_description, p_project_id);
END;
$$;

-- Seuls les appels serveur (service role) peuvent appeler cette fonction
REVOKE ALL ON FUNCTION deduct_credits FROM PUBLIC;
