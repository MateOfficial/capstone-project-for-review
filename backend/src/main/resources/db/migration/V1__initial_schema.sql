-- StoreFlow Platform - Initial Schema
-- V1: Core tables for all modules

-- =============================================
-- STORE / TENANT CONTEXT
-- =============================================
CREATE TABLE stores (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50) UNIQUE NOT NULL,
    brand_name      VARCHAR(255),
    logo_url        VARCHAR(500),
    address         TEXT,
    phone           VARCHAR(50),
    email           VARCHAR(255),
    website         VARCHAR(255),
    locale          VARCHAR(10) DEFAULT 'ru',
    currency        VARCHAR(10) DEFAULT 'UZS',
    timezone        VARCHAR(50) DEFAULT 'Asia/Tashkent',
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================
-- SETUP STATE (ONBOARDING)
-- =============================================
CREATE TABLE setup_state (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT REFERENCES stores(id) ON DELETE CASCADE,
    initialized     BOOLEAN DEFAULT FALSE,
    current_step    VARCHAR(50) DEFAULT 'store_profile',
    completed_steps TEXT[] DEFAULT '{}',
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id)
);

-- =============================================
-- AUTH: USERS, ROLES, PERMISSIONS
-- =============================================
CREATE TABLE permissions (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    module          VARCHAR(50) NOT NULL
);

CREATE TABLE roles (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT REFERENCES stores(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    system_role     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, code)
);

CREATE TABLE role_permissions (
    role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT REFERENCES stores(id) ON DELETE CASCADE,
    username        VARCHAR(100) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    full_name       VARCHAR(255),
    active          BOOLEAN DEFAULT TRUE,
    system_account  BOOLEAN DEFAULT FALSE,
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    UNIQUE(store_id, username)
);

CREATE TABLE user_roles (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(500) UNIQUE NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- =============================================
-- CATALOG: CATEGORIES & PRODUCTS
-- =============================================
CREATE TABLE categories (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    parent_id       BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    sort_order      INTEGER DEFAULT 0,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, slug)
);

CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code            VARCHAR(100),
    name            VARCHAR(500) NOT NULL,
    search_key      VARCHAR(500),
    description     TEXT,
    detailed_description TEXT,
    category_id     BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    price           BIGINT DEFAULT 0,
    discount        INTEGER DEFAULT 0 CHECK (discount >= 0 AND discount <= 100),
    stock_quantity  INTEGER,
    active          BOOLEAN DEFAULT TRUE,
    features        JSONB DEFAULT '[]'::jsonb,
    characteristics TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by      BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(store_id, name);
CREATE INDEX idx_products_search ON products(store_id, search_key);
CREATE INDEX idx_products_code ON products(store_id, code);

CREATE TABLE product_images (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    alt_text        VARCHAR(255),
    sort_order      INTEGER DEFAULT 0,
    primary_image   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- =============================================
-- CRM: CLIENTS
-- =============================================
CREATE TABLE clients (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    email           VARCHAR(255),
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_clients_phone ON clients(store_id, phone) WHERE phone IS NOT NULL AND phone != '';
CREATE INDEX idx_clients_store ON clients(store_id);
CREATE INDEX idx_clients_name ON clients(store_id, full_name);

-- =============================================
-- HR: EMPLOYEES, ATTENDANCE, SCHEDULES
-- =============================================
CREATE TABLE employees (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    pin             VARCHAR(10),
    phone           VARCHAR(50),
    position        VARCHAR(255),
    active          BOOLEAN DEFAULT TRUE,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_store ON employees(store_id);

CREATE TABLE attendance_records (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name   VARCHAR(255) NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('check-in', 'check-out')),
    ip_address      VARCHAR(45),
    timestamp       TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_store_date ON attendance_records(store_id, timestamp);
CREATE INDEX idx_attendance_employee ON attendance_records(employee_id);

CREATE TABLE schedules (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    type            VARCHAR(30) NOT NULL CHECK (type IN ('dayoff-stable', 'dayoff-rotating', 'work', 'vacation', 'sick')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, employee_id, date)
);

CREATE INDEX idx_schedules_store_date ON schedules(store_id, date);

-- =============================================
-- DOCUMENTS: WARRANTIES & ISSUANCE ACTS
-- =============================================
CREATE TABLE warranty_rules (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    brand           VARCHAR(100) NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 12,
    terms           TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, brand)
);

CREATE TABLE warranties (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    warranty_number VARCHAR(20) UNIQUE NOT NULL,
    model           VARCHAR(255) NOT NULL,
    serial_number   VARCHAR(255),
    brand           VARCHAR(100),
    duration_months INTEGER NOT NULL DEFAULT 12,
    client_id       BIGINT REFERENCES clients(id) ON DELETE SET NULL,
    signature_data  TEXT,
    ip_address      VARCHAR(45),
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_warranties_store ON warranties(store_id);
CREATE INDEX idx_warranties_number ON warranties(warranty_number);
CREATE INDEX idx_warranties_client ON warranties(client_id);

CREATE TABLE issuance_acts (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    act_number      VARCHAR(50) UNIQUE NOT NULL,
    model           VARCHAR(255) NOT NULL,
    serial_number   VARCHAR(255),
    price           VARCHAR(100),
    return_date     DATE,
    client_name     VARCHAR(255),
    client_phone    VARCHAR(50),
    condition       VARCHAR(50) CHECK (condition IN ('new', 'display', 'other')),
    completeness    JSONB DEFAULT '[]'::jsonb,
    notes           TEXT,
    signature_data  TEXT,
    ip_address      VARCHAR(45),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'returned', 'cancelled')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_issuance_acts_store ON issuance_acts(store_id);

-- =============================================
-- DOCUMENT TEMPLATES
-- =============================================
CREATE TABLE document_templates (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL CHECK (type IN ('warranty', 'issuance_act', 'commercial_proposal')),
    name            VARCHAR(255) NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    content         TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_doc_templates_store_type ON document_templates(store_id, type);

-- =============================================
-- SETTINGS (STORE-LEVEL KEY-VALUE)
-- =============================================
CREATE TABLE settings (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    setting_key     VARCHAR(255) NOT NULL,
    value           TEXT,
    type            VARCHAR(20) DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json', 'image')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, setting_key)
);

-- =============================================
-- MODULE TOGGLES
-- =============================================
CREATE TABLE module_config (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    module_code     VARCHAR(50) NOT NULL,
    enabled         BOOLEAN DEFAULT TRUE,
    config          JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, module_code)
);

-- =============================================
-- AUDIT LOG
-- =============================================
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    store_id        BIGINT REFERENCES stores(id) ON DELETE SET NULL,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username        VARCHAR(100),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100),
    entity_id       VARCHAR(100),
    details         JSONB,
    ip_address      VARCHAR(45),
    timestamp       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_store_time ON audit_log(store_id, timestamp);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
