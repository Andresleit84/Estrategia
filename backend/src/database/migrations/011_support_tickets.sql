-- Hito: Módulo de Soporte / Tickets internos

-- ── Tablas ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  category        text        NOT NULL DEFAULT 'general'
                              CHECK (category IN ('general','bug','feature','billing','access','other')),
  status          text        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  is_staff   boolean     NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org  ON support_tickets(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at ASC);

-- ── Vista: lista de tickets ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_support_tickets AS
SELECT
  t.id,
  t.organization_id,
  t.user_id,
  t.title,
  t.category,
  t.status,
  t.created_at,
  t.updated_at,
  u.name  AS user_name,
  u.email AS user_email,
  (SELECT COUNT(*)        FROM support_messages m WHERE m.ticket_id = t.id)              AS message_count,
  (SELECT MAX(created_at) FROM support_messages m WHERE m.ticket_id = t.id)              AS last_reply_at,
  (SELECT body            FROM support_messages m WHERE m.ticket_id = t.id
   ORDER BY created_at ASC LIMIT 1)                                                       AS first_message
FROM support_tickets t
JOIN users u ON u.id = t.user_id;

-- ── Vista: detalle con mensajes (JSON) ───────────────────────────────────────

CREATE OR REPLACE VIEW v_support_ticket_detail AS
SELECT
  t.id,
  t.organization_id,
  t.user_id,
  t.title,
  t.category,
  t.status,
  t.created_at,
  t.updated_at,
  u.name  AS user_name,
  u.email AS user_email,
  COALESCE(
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id',         m.id,
         'sender_id',  m.sender_id,
         'sender_name', su.name,
         'is_staff',   m.is_staff,
         'body',       m.body,
         'created_at', m.created_at
       ) ORDER BY m.created_at ASC
     )
     FROM support_messages m
     JOIN users su ON su.id = m.sender_id
     WHERE m.ticket_id = t.id
    ), '[]'
  ) AS messages
FROM support_tickets t
JOIN users u ON u.id = t.user_id;

-- ── SP: crear ticket + primer mensaje ────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_support_ticket(
  p_org_id    uuid,
  p_user_id   uuid,
  p_title     text,
  p_category  text,
  p_body      text,
  INOUT p_ticket_id uuid DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  IF char_length(trim(p_title)) < 3 THEN
    RAISE EXCEPTION 'El título debe tener al menos 3 caracteres' USING ERRCODE = 'P0011';
  END IF;
  IF char_length(trim(p_body)) < 10 THEN
    RAISE EXCEPTION 'El mensaje debe tener al menos 10 caracteres' USING ERRCODE = 'P0011';
  END IF;

  INSERT INTO support_tickets (organization_id, user_id, title, category)
  VALUES (p_org_id, p_user_id, trim(p_title), p_category)
  RETURNING id INTO p_ticket_id;

  INSERT INTO support_messages (ticket_id, sender_id, body, is_staff)
  VALUES (p_ticket_id, p_user_id, trim(p_body), FALSE);

  UPDATE support_tickets SET updated_at = NOW() WHERE id = p_ticket_id;
END;
$$;

-- ── SP: agregar mensaje ───────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_add_support_message(
  p_ticket_id uuid,
  p_sender_id uuid,
  p_body      text,
  p_is_staff  boolean DEFAULT FALSE
)
LANGUAGE plpgsql AS $$
BEGIN
  IF char_length(trim(p_body)) < 1 THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío' USING ERRCODE = 'P0011';
  END IF;

  INSERT INTO support_messages (ticket_id, sender_id, body, is_staff)
  VALUES (p_ticket_id, p_sender_id, trim(p_body), p_is_staff);

  UPDATE support_tickets
     SET updated_at = NOW(),
         status = CASE WHEN p_is_staff AND status = 'open' THEN 'in_progress' ELSE status END
   WHERE id = p_ticket_id;
END;
$$;

-- ── Trigger: updated_at automático ───────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_tickets_updated_at'
  ) THEN
    CREATE TRIGGER trg_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;
