-- Migration 075: Telegram Multi-Tenant RBAC Architecture
-- Fecha: 2026-06-17
-- Descripción: Soporta múltiples organizaciones con tópicos y control de acceso

-- 1. Tabla: telegram_organizations
-- Almacena info de cada organización (banco) en Telegram
CREATE TABLE IF NOT EXISTS telegram_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL,  -- ID del grupo Telegram (ej: -1004351862659)
  group_name VARCHAR(255) NOT NULL,  -- Nombre del grupo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telegram_orgs_org_id ON telegram_organizations(organization_id);
CREATE INDEX idx_telegram_orgs_group_id ON telegram_organizations(group_id);

-- 2. Tabla: telegram_topics
-- Almacena los tópicos dentro de cada grupo
CREATE TABLE IF NOT EXISTS telegram_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_organization_id UUID NOT NULL REFERENCES telegram_organizations(id) ON DELETE CASCADE,
  topic_name VARCHAR(100) NOT NULL,  -- "Risk Sentinel", "Executive Briefer", etc
  alert_type VARCHAR(50) NOT NULL,  -- "risk_sentinel", "executive_briefer", etc
  topic_internal_id INT,  -- ID interno de Telegram del tópico (si aplica)
  visibility VARCHAR(20) NOT NULL DEFAULT 'all',  -- "all", "executives", "admin"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_visibility CHECK (visibility IN ('all', 'executives', 'admin'))
);

CREATE INDEX idx_telegram_topics_org ON telegram_topics(telegram_organization_id);
CREATE INDEX idx_telegram_topics_alert_type ON telegram_topics(alert_type);

-- 3. Tabla: telegram_subscriptions
-- Quién recibe qué alertas en Telegram
CREATE TABLE IF NOT EXISTS telegram_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Datos de Telegram del usuario
  telegram_user_id BIGINT NOT NULL,  -- ID de usuario Telegram
  telegram_chat_id BIGINT NOT NULL,  -- Chat ID privado para DMs

  -- Permisos (qué alertas ve)
  receive_risk_sentinel BOOLEAN NOT NULL DEFAULT true,
  receive_executive_briefer BOOLEAN NOT NULL DEFAULT true,
  receive_checkin_reminders BOOLEAN NOT NULL DEFAULT true,
  receive_cycle_status BOOLEAN NOT NULL DEFAULT true,
  receive_agreements BOOLEAN NOT NULL DEFAULT true,
  receive_admin_alerts BOOLEAN NOT NULL DEFAULT false,

  -- Control
  notify_via_dm BOOLEAN NOT NULL DEFAULT false,  -- Además del grupo
  mute_until TIMESTAMPTZ,  -- Pausar notificaciones hasta X fecha
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_telegram_user_org UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_telegram_subs_user ON telegram_subscriptions(user_id);
CREATE INDEX idx_telegram_subs_org ON telegram_subscriptions(organization_id);
CREATE INDEX idx_telegram_subs_telegram_user ON telegram_subscriptions(telegram_user_id);
CREATE INDEX idx_telegram_subs_active ON telegram_subscriptions(is_active, organization_id);

-- 4. Tabla: telegram_sent_messages
-- Audit log de mensajes enviados (para tracking y debugging)
CREATE TABLE IF NOT EXISTS telegram_sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,  -- "risk_sentinel", etc
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  group_id BIGINT,
  topic_name VARCHAR(100),
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent',  -- "sent", "failed"
  error_message TEXT,

  CONSTRAINT chk_status CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX idx_telegram_sent_org ON telegram_sent_messages(organization_id);
CREATE INDEX idx_telegram_sent_alert_type ON telegram_sent_messages(alert_type, sent_at);
CREATE INDEX idx_telegram_sent_status ON telegram_sent_messages(status, sent_at);

-- 5. Función: fn_get_telegram_config
-- Retorna la configuración de Telegram para una organización
CREATE OR REPLACE FUNCTION fn_get_telegram_config(p_organization_id UUID)
RETURNS TABLE (
  organization_id UUID,
  group_id BIGINT,
  group_name VARCHAR,
  topics JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to.organization_id,
    to.group_id,
    to.group_name,
    jsonb_agg(
      jsonb_build_object(
        'topic_name', tt.topic_name,
        'alert_type', tt.alert_type,
        'visibility', tt.visibility
      )
    ) AS topics
  FROM telegram_organizations to
  LEFT JOIN telegram_topics tt ON to.id = tt.telegram_organization_id
  WHERE to.organization_id = p_organization_id
  GROUP BY to.id, to.organization_id, to.group_id, to.group_name;
END;
$$ LANGUAGE plpgsql;

-- 6. Función: fn_get_telegram_subscribers
-- Retorna lista de usuarios que deben recibir un alert
CREATE OR REPLACE FUNCTION fn_get_telegram_subscribers(
  p_organization_id UUID,
  p_alert_type VARCHAR,
  p_visibility VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
  user_id UUID,
  telegram_user_id BIGINT,
  telegram_chat_id BIGINT,
  user_role VARCHAR,
  notify_via_dm BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ts.user_id,
    ts.telegram_user_id,
    ts.telegram_chat_id,
    u.role,
    ts.notify_via_dm
  FROM telegram_subscriptions ts
  JOIN users u ON ts.user_id = u.id
  WHERE ts.organization_id = p_organization_id
    AND ts.is_active = true
    AND ts.mute_until IS NULL OR ts.mute_until < NOW()
    AND CASE
      WHEN p_alert_type = 'risk_sentinel' THEN ts.receive_risk_sentinel
      WHEN p_alert_type = 'executive_briefer' THEN ts.receive_executive_briefer
      WHEN p_alert_type = 'checkin_reminders' THEN ts.receive_checkin_reminders
      WHEN p_alert_type = 'cycle_status' THEN ts.receive_cycle_status
      WHEN p_alert_type = 'agreements' THEN ts.receive_agreements
      WHEN p_alert_type = 'admin_alerts' THEN ts.receive_admin_alerts
      ELSE false
    END = true
    AND CASE
      WHEN p_visibility = 'all' THEN true
      WHEN p_visibility = 'executives' THEN u.role IN ('CEO', 'CFO', 'CRO', 'ADMIN')
      WHEN p_visibility = 'admin' THEN u.role = 'ADMIN'
      ELSE false
    END;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger: audit_telegram_subscriptions
-- Log de cambios en subscripciones
CREATE OR REPLACE FUNCTION trg_audit_telegram_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    action, table_name, record_id, changed_by, old_values, new_values
  ) VALUES (
    TG_OP,
    'telegram_subscriptions',
    NEW.id,
    CURRENT_USER_ID(),
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_telegram_subscriptions_audit
AFTER INSERT OR UPDATE ON telegram_subscriptions
FOR EACH ROW EXECUTE FUNCTION trg_audit_telegram_subscriptions();
