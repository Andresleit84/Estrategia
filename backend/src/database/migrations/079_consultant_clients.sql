-- Tabla para vincular consultores externos (por email) con organizaciones cliente.
-- Fue creada directamente en producción sin migración; este archivo la formaliza
-- para que instalaciones nuevas incluyan la tabla.
CREATE TABLE IF NOT EXISTS consultant_clients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_email      TEXT        NOT NULL,
  client_org_id         UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  digest_enabled        BOOLEAN     NOT NULL DEFAULT true,
  client_alerts_enabled BOOLEAN     NOT NULL DEFAULT false,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consultant_email, client_org_id)
);

CREATE INDEX IF NOT EXISTS idx_consultant_clients_email  ON consultant_clients(consultant_email);
CREATE INDEX IF NOT EXISTS idx_consultant_clients_org    ON consultant_clients(client_org_id);
