-- Small seed for ISO standard and a handful of Annex A controls
-- Customize or replace with full Annex A import as needed

INSERT INTO standards (id, code, title, description) VALUES ('iso27001', 'ISO/IEC 27001', 'ISO/IEC 27001:2022', 'Information security management standard') ON CONFLICT (id) DO NOTHING;

INSERT INTO controls (id, control_id, standard_id, name, description, applicable, status) VALUES
('ctrl-a5-1', 'A.5.1', 'iso27001', 'Policies for information security', 'Management direction and support for information security policies', true, 'not-appraised'),
('ctrl-a6-1', 'A.6.1', 'iso27001', 'Organization of information security', 'Internal organization for information security and responsibilities', true, 'not-appraised'),
('ctrl-a8-1', 'A.8.1', 'iso27001', 'Asset management', 'Inventory and ownership of assets', true, 'not-appraised')
ON CONFLICT (control_id) DO NOTHING;
