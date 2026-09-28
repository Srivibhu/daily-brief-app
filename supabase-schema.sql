-- Daily Brief App — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Users (custom auth, no Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags (per user, customisable)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  tags TEXT[] DEFAULT '{}',
  priority TEXT CHECK (priority IN ('p1','p2','p3') OR priority IS NULL),
  link TEXT DEFAULT '',
  due DATE,
  due_time TIME,
  history JSONB DEFAULT '[]',
  created_at DATE DEFAULT CURRENT_DATE,
  completed_at DATE,
  week_number INT GENERATED ALWAYS AS (EXTRACT(WEEK FROM created_at)::INT) STORED,
  year_number INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM created_at)::INT) STORED
);

-- Focus sessions
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  minutes INT NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  task_name TEXT,
  time_of_day TEXT,
  manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default tags for new users (called after registration via trigger)
CREATE OR REPLACE FUNCTION seed_default_tags()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tags (user_id, name, color) VALUES
    (NEW.id, 'Work',     '#3b82f6'),
    (NEW.id, 'Study',    '#06b6d4'),
    (NEW.id, 'Health',   '#22c55e'),
    (NEW.id, 'Urgent',   '#ef4444'),
    (NEW.id, 'Personal', '#f59e0b');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_user_insert
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION seed_default_tags();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due);
CREATE INDEX IF NOT EXISTS idx_tasks_week ON tasks(user_id, week_number, year_number);
CREATE INDEX IF NOT EXISTS idx_focus_user_date ON focus_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
