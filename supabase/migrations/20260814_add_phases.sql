-- Add phases table for project phases
CREATE TABLE IF NOT EXISTS phases (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  assigned_team JSONB,
  requirements TEXT,
  submissions JSONB,
  status TEXT,
  progress INTEGER,
  leader TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id);
