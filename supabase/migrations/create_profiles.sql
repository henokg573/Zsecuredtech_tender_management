-- Create profiles table for Supabase Auth user metadata
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  telegram TEXT,
  telegram_chat_id TEXT,
  role TEXT DEFAULT 'staff',
  initials TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Basic index
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
