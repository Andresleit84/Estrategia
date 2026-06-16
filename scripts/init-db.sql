-- ================================================================
-- Script de inicialización de base de datos
-- Se ejecuta solo la primera vez al crear la DB
-- Las migraciones reales las maneja Prisma
-- ================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID v4
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Full-text search trigram
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Búsqueda sin tildes

-- Verificación
SELECT version();
SELECT current_database();
