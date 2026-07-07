-- Migration: Add level, status, response_code, duration_ms to audit_logs
-- These columns have defaults so existing data remains valid.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'log' NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success' NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS response_code INTEGER DEFAULT 200;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
