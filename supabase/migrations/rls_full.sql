-- Full RLS policy examples for production use — review carefully and test in staging.

-- Enable RLS and policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
CREATE POLICY "profiles_update_admin_or_self" ON profiles FOR UPDATE USING (auth.uid() = id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) WITH CHECK (auth.uid() = id OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Projects: allow select to authenticated users; only manager or admin can update/delete
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_select_authed" ON projects FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "projects_update_manager_or_admin" ON projects FOR UPDATE USING (auth.uid() = manager OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) WITH CHECK (auth.uid() = manager OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
CREATE POLICY "projects_delete_admin" ON projects FOR DELETE USING (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Tasks: assignee, project manager, or admin can update; anyone authed can select
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_authed" ON tasks FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "tasks_update_assignee_or_manager_or_admin" ON tasks FOR UPDATE USING (
  auth.uid() = assignee_id OR exists (select 1 from projects pr where pr.id = project_id and pr.manager = auth.uid()) OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
) WITH CHECK (
  auth.uid() = assignee_id OR exists (select 1 from projects pr where pr.id = project_id and pr.manager = auth.uid()) OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Phases: project manager or admin may update
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phases_select_authed" ON phases FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "phases_update_manager_or_admin" ON phases FOR UPDATE USING (
  exists (select 1 from projects pr where pr.id = phases.project_id and pr.manager = auth.uid()) OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
) WITH CHECK (
  exists (select 1 from projects pr where pr.id = phases.project_id and pr.manager = auth.uid()) OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Documents: owner or project manager or admin
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select_authed" ON documents FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "documents_update_owner_or_manager_or_admin" ON documents FOR UPDATE USING (
  auth.uid() = uploaded_by OR exists (select 1 from projects pr where pr.id = documents.project_id and pr.manager = auth.uid()) OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
) WITH CHECK (
  auth.uid() = uploaded_by OR exists (select 1 from projects pr where pr.id = documents.project_id and pr.manager = auth.uid()) OR exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Controls, standards, clauses: admin or manager
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "controls_select_authed" ON controls FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "controls_update_admin_or_manager" ON controls FOR UPDATE USING (exists (select 1 from profiles p where p.id = auth.uid() and p.role IN ('admin','manager'))) WITH CHECK (exists (select 1 from profiles p where p.id = auth.uid() and p.role IN ('admin','manager')));

-- IMPORTANT: Adapt column names (assignee_id, manager, uploaded_by) to match your actual schema. Test in staging before applying to production.
