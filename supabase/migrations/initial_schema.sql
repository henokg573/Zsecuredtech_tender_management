-- Initial Supabase/Postgres schema for Advanced Tender Management System
-- Run these in the Supabase SQL editor or via psql against your project

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT,
  password_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Offices
CREATE TABLE IF NOT EXISTS offices (
  id TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  phone TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_info JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT,
  description TEXT,
  status TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT,
  due_date TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT,
  description TEXT,
  storage_path TEXT,
  content JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT,
  notes TEXT,
  attendees JSONB,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Standards (e.g., ISO 27001)
CREATE TABLE IF NOT EXISTS standards (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  title TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clauses (sections of a standard)
CREATE TABLE IF NOT EXISTS clauses (
  id TEXT PRIMARY KEY,
  standard_id TEXT REFERENCES standards(id) ON DELETE CASCADE,
  clause_ref TEXT,
  title TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Annex A Controls
CREATE TABLE IF NOT EXISTS controls (
  id TEXT PRIMARY KEY,
  control_id TEXT UNIQUE,
  standard_id TEXT REFERENCES standards(id) ON DELETE SET NULL,
  name TEXT,
  description TEXT,
  applicable BOOLEAN DEFAULT true,
  status TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  evidence JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gap assessments
CREATE TABLE IF NOT EXISTS gaps (
  id TEXT PRIMARY KEY,
  control_id TEXT REFERENCES controls(id) ON DELETE CASCADE,
  assessed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  severity TEXT,
  remediation TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Risk register
CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  likelihood INTEGER,
  impact INTEGER,
  score INTEGER,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  treatments JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_controls_standard ON controls(standard_id);

-- Note: After creating tables, enable Row Level Security and add policies suitable for your roles.
