-- V2: Seed default permissions and system roles

-- Permissions by module
INSERT INTO permissions (code, name, description, module) VALUES
    ('catalog.view', 'View Catalog', 'View products and categories', 'catalog'),
    ('catalog.manage', 'Manage Catalog', 'Create, edit, delete products and categories', 'catalog'),
    ('catalog.manage_prices', 'Manage Prices', 'Edit product prices', 'catalog'),
    ('catalog.manage_discounts', 'Manage Discounts', 'Edit product discounts', 'catalog'),
    ('catalog.import', 'Import Products', 'Import products from Excel/CSV', 'catalog'),
    ('crm.view', 'View Clients', 'View client records', 'crm'),
    ('crm.manage', 'Manage Clients', 'Create, edit, delete clients', 'crm'),
    ('hr.view', 'View HR', 'View employees, attendance, schedules', 'hr'),
    ('hr.manage', 'Manage HR', 'Manage employees, attendance, schedules', 'hr'),
    ('documents.view', 'View Documents', 'View warranties and issuance acts', 'documents'),
    ('documents.manage', 'Manage Documents', 'Create, edit, delete documents', 'documents'),
    ('documents.templates', 'Manage Templates', 'Manage document templates', 'documents'),
    ('reports.view', 'View Reports', 'View operational reports', 'reporting'),
    ('reports.export', 'Export Reports', 'Export data reports', 'reporting'),
    ('settings.view', 'View Settings', 'View store settings', 'settings'),
    ('settings.manage', 'Manage Settings', 'Modify store settings and rules', 'settings'),
    ('admin.users', 'Manage Users', 'Manage admin users and roles', 'auth'),
    ('admin.audit', 'View Audit Log', 'View audit trail', 'audit'),
    ('onboarding.manage', 'Manage Onboarding', 'Run setup wizard', 'onboarding');
