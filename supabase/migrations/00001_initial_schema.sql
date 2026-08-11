-- ============================================================
-- Casa Quest — Initial Database Schema
-- PostgreSQL 15+ / Supabase
-- 3FN+ normalized, immutable event sourcing for energy/cooperation
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. FAMILIES
-- ============================================================
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID,  -- references auth.users(id), set after auth setup
  timezone TEXT DEFAULT 'America/Sao_Paulo',

  -- Confirmation quorum config
  quorum_type TEXT NOT NULL DEFAULT 'dynamic'
    CHECK (quorum_type IN ('dynamic', 'fixed')),
  quorum_small_family INT DEFAULT 1,
  quorum_large_family INT DEFAULT 2,
  quorum_threshold INT DEFAULT 3,
  quorum_fixed INT DEFAULT 1,

  -- Tolerance
  tolerance_minutes INT DEFAULT 30,

  -- Recovery
  recovery_enabled BOOLEAN DEFAULT true,
  recovery_value INT DEFAULT 2,

  -- Auxilio
  auxilio_enabled BOOLEAN DEFAULT true,

  -- Escalada
  escalada_enabled BOOLEAN DEFAULT false,

  -- Mission defaults
  mission_duration_days INT DEFAULT 15,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. GUARDIANS
-- ============================================================
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT,
  avatar_url TEXT,

  -- Role
  is_mor BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Auth for Mor (links to Supabase Auth)
  email TEXT UNIQUE,
  user_id UUID UNIQUE, -- references auth.users(id)

  -- Token-based access for Guardians (not Mor)
  access_token_hash TEXT UNIQUE,  -- SHA-256 of generated token
  token_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guardians_family ON guardians(family_id);
CREATE INDEX idx_guardians_token ON guardians(access_token_hash);
CREATE INDEX idx_guardians_user_id ON guardians(user_id);

-- ============================================================
-- 3. ACTION TEMPLATES
-- ============================================================
CREATE TABLE action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Category: habits, cooperation, missions, kindness, self-improvement, school
  category TEXT NOT NULL DEFAULT 'habitos'
    CHECK (category IN (
      'habitos', 'cooperacao', 'missoes', 'gentilezas',
      'autoaperfeicoamento', 'rendimento_escolar'
    )),

  -- Action type: basic (responsibility), recovery (compensate), escalada (go beyond)
  action_type TEXT NOT NULL DEFAULT 'basic'
    CHECK (action_type IN ('basic', 'recovery', 'escalada')),

  default_due_time TIME DEFAULT '20:00',
  default_duration INT,         -- minutes
  frequency TEXT DEFAULT 'daily',

  -- Collective action flag
  is_collective BOOLEAN DEFAULT false,

  -- Confirmation configuration
  confirmation_mode TEXT DEFAULT 'none'
    CHECK (confirmation_mode IN ('none', 'one_peer', 'quorum', 'adult_only')),
  confirmation_quorum_override INT,
  tolerance_minutes_override INT,

  -- Recovery specific
  recovery_value_override INT,

  -- Escalada specific
  escalada_category TEXT,
  escalada_base_points INT DEFAULT 2,
  escalada_bonus_multiplier DECIMAL DEFAULT 1.0,
  escalada_max_per_mission INT DEFAULT 10,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_action_templates_family ON action_templates(family_id);

-- ============================================================
-- 4. MISSIONS
-- ============================================================
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_at DATE NOT NULL,
  end_at DATE NOT NULL,
  target_reward_amount DECIMAL(10,2) NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_date_range CHECK (end_at > start_at)
);

CREATE INDEX idx_missions_family ON missions(family_id);
CREATE INDEX idx_missions_status ON missions(status);

-- ============================================================
-- 5. MISSION GUARDIANS (per-guardian per-mission state)
-- ============================================================
CREATE TABLE mission_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,

  target_reward DECIMAL(10,2),
  initial_energy DECIMAL(10,2) DEFAULT 100,
  current_energy DECIMAL(10,2) DEFAULT 100,
  final_energy DECIMAL(10,2),
  final_reward DECIMAL(10,2),

  cooperation_score INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(mission_id, guardian_id)
);

CREATE INDEX idx_mission_guardians_mission ON mission_guardians(mission_id);
CREATE INDEX idx_mission_guardians_guardian ON mission_guardians(guardian_id);

-- ============================================================
-- 6. MISSION ACTIONS (concrete instances)
-- ============================================================
CREATE TABLE mission_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  action_template_id UUID REFERENCES action_templates(id) ON DELETE SET NULL,

  due_at TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'marked_done', 'confirmed', 'missed', 'cancelled'
    )),

  completed_at TIMESTAMPTZ,
  missed_at TIMESTAMPTZ,

  confirmation_status TEXT DEFAULT 'pending'
    CHECK (confirmation_status IN (
      'pending', 'confirmed', 'rejected', 'not_required'
    )),

  -- For auxilio: who rescued this action
  rescued_by_guardian_id UUID REFERENCES guardians(id),

  -- For escalada: points earned
  escalada_points_earned INT DEFAULT 0,

  -- For recovery: links to the missed action being recovered
  recovers_action_id UUID REFERENCES mission_actions(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mission_actions_mission ON mission_actions(mission_id);
CREATE INDEX idx_mission_actions_guardian ON mission_actions(guardian_id);
CREATE INDEX idx_mission_actions_status ON mission_actions(status);
CREATE INDEX idx_mission_actions_due ON mission_actions(due_at);

-- ============================================================
-- 7. ACTION CONFIRMATIONS
-- ============================================================
CREATE TABLE action_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_action_id UUID NOT NULL REFERENCES mission_actions(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,

  decision TEXT NOT NULL CHECK (decision IN ('confirmed', 'rejected')),
  justification TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(mission_action_id, guardian_id)
);

CREATE INDEX idx_confirmations_action ON action_confirmations(mission_action_id);

-- ============================================================
-- 8. ENERGY EVENTS (IMMUTABLE — Event Sourcing)
-- ============================================================
CREATE TABLE energy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (event_type IN (
    'initial_energy', 'miss', 'recovery', 'auxilio',
    'escalada', 'manual_adjustment'
  )),

  amount DECIMAL(10,2) NOT NULL,
  source_id UUID,                    -- references mission_action or null for manual
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES guardians(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_energy_events_guardian ON energy_events(guardian_id, mission_id);
CREATE INDEX idx_energy_events_created ON energy_events(created_at);

-- Immutability: no updates or deletes on energy events
CREATE OR REPLACE FUNCTION prevent_energy_event_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Energy events are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER energy_events_immutable
  BEFORE UPDATE OR DELETE ON energy_events
  FOR EACH ROW EXECUTE FUNCTION prevent_energy_event_modification();

-- ============================================================
-- 9. COOPERATION EVENTS (IMMUTABLE — Event Sourcing)
-- ============================================================
CREATE TABLE cooperation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (event_type IN (
    'auxilio', 'collective_action', 'manual_adjustment'
  )),

  score_delta INT NOT NULL,
  source_id UUID,
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES guardians(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cooperation_events_guardian ON cooperation_events(guardian_id, mission_id);

CREATE TRIGGER cooperation_events_immutable
  BEFORE UPDATE OR DELETE ON cooperation_events
  FOR EACH ROW EXECUTE FUNCTION prevent_energy_event_modification();

-- ============================================================
-- 10. ESCALADA CATEGORIES
-- ============================================================
CREATE TABLE escalada_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  base_points INT NOT NULL DEFAULT 2,
  bonus_multiplier DECIMAL DEFAULT 1.0,
  max_per_mission INT DEFAULT 10,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_escalada_categories_family ON escalada_categories(family_id);

-- DECISION: Seed categories are created per-family during onboarding (see API route).
-- The INSERT below is commented out because it requires a valid family_id.

-- ============================================================
-- HELPER: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER action_templates_updated_at
  BEFORE UPDATE ON action_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER guardians_updated_at
  BEFORE UPDATE ON guardians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
