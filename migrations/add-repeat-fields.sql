-- Migration: add recurring-task fields
-- Run once in the Supabase SQL Editor (safe to re-run).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS repeat_type     TEXT NOT NULL DEFAULT 'none'
    CHECK (repeat_type IN ('none','daily','weekly')),
  ADD COLUMN IF NOT EXISTS repeat_interval INT  NOT NULL DEFAULT 1
    CHECK (repeat_interval >= 1 AND repeat_interval <= 365);
