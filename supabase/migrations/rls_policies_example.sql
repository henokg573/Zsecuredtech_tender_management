-- Example RLS policies for key tables. Review and adapt before applying to production.

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT their own profile
CREATE POLICY "select_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);

-- Allow insert if auth.uid() equals new id (sign-up via server or client)
CREATE POLICY "insert_profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow update/delete for owner or admin
CREATE POLICY "update_own_or_admin" ON profiles FOR UPDATE USING (auth.uid() = id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) WITH CHECK (auth.uid() = id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
CREATE POLICY "delete_own_or_admin" ON profiles FOR DELETE USING (auth.uid() = id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Example for projects: authenticated users can select; only manager/admin can update
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_projects_authed" ON projects FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "update_projects_manager_or_admin" ON projects FOR UPDATE USING (auth.uid() = manager OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) WITH CHECK (auth.uid() = manager OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Example for tasks: assignee or project manager or admin can update
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_tasks_authed" ON tasks FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "update_tasks_assignee_or_admin" ON tasks FOR UPDATE USING (auth.uid() = assignee_id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) WITH CHECK (auth.uid() = assignee_id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- IMPORTANT: Replace column names like `manager`, `assignee_id` with your actual column names, and test policies in a staging environment.
