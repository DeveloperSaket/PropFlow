CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  is_agent SMALLINT NOT NULL DEFAULT 0 CHECK (is_agent IN (0, 1)),
  kyc_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
  terms_accepted_at TIMESTAMPTZ,
  active SMALLINT NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE properties (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT NOT NULL CHECK (property_type IN (
    'detached', 'semi_detached', 'freehold_townhouse', 'condo_townhouse',
    'condo_apt', 'link', 'vacant_land', 'other', 'apartment', 'house',
    'plot', 'commercial', 'villa'
  )),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  price DOUBLE PRECISION NOT NULL,
  area_sqft DOUBLE PRECISION,
  bedrooms INTEGER,
  bathrooms INTEGER,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Canada',
  pincode TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'sold')),
  rejection_reason TEXT,
  featured SMALLINT NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE property_images (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL
);

CREATE TABLE interests (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'negotiating', 'closed', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (property_id, buyer_id)
);

CREATE TABLE appointments (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compliance_docs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  reviewed_by BIGINT REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id BIGINT,
  meta TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  job_title TEXT,
  team TEXT,
  manager_user_id BIGINT REFERENCES staff_profiles(user_id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'on_leave', 'departed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role SMALLINT NOT NULL DEFAULT 1 CHECK (is_system_role IN (0, 1))
);

CREATE TABLE permissions (
  id BIGSERIAL PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES staff_profiles(user_id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE staff_role_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_migrations (
  migration_key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_seller ON properties(seller_id);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_interests_buyer ON interests(buyer_id);
CREATE INDEX idx_interests_property ON interests(property_id);
CREATE INDEX idx_appointments_buyer ON appointments(buyer_id);
CREATE INDEX idx_appointments_seller ON appointments(seller_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE UNIQUE INDEX idx_staff_role_requests_pending
  ON staff_role_requests(user_id, role_id) WHERE status = 'pending';
CREATE INDEX idx_staff_role_requests_status ON staff_role_requests(status, created_at);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

INSERT INTO permissions (permission_key, description) VALUES
  ('dashboard.read', 'View staff dashboard metrics'),
  ('users.read', 'View platform user accounts'),
  ('users.manage', 'Activate and deactivate platform accounts'),
  ('users.agent', 'Manage agent flags on platform accounts'),
  ('kyc.review', 'Review user KYC submissions'),
  ('listings.read', 'View listings awaiting moderation'),
  ('listings.review', 'Approve or reject listings'),
  ('listings.feature', 'Feature listings'),
  ('appointments.read', 'View platform appointments'),
  ('audit.read', 'View audit records'),
  ('staff.manage', 'Assign and revoke staff roles'),
  ('staff.requests.review', 'Approve or reject staff role requests');

INSERT INTO roles (role_key, name, description) VALUES
  ('owner', 'Owner / Super Admin', 'Manage staff and all platform administration'),
  ('listing_moderator', 'Listing Moderator', 'Review and feature property listings'),
  ('compliance_reviewer', 'Compliance Reviewer', 'Review user KYC submissions'),
  ('support_agent', 'Support Agent', 'Look up users and view appointments'),
  ('read_only_analyst', 'Read-only Analyst', 'View dashboard metrics and audit records');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'owner';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.permission_key IN (
  'dashboard.read', 'listings.read', 'listings.review', 'listings.feature'
)
WHERE r.role_key = 'listing_moderator';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.permission_key IN (
  'dashboard.read', 'users.read', 'kyc.review'
)
WHERE r.role_key = 'compliance_reviewer';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.permission_key IN (
  'dashboard.read', 'users.read', 'appointments.read'
)
WHERE r.role_key = 'support_agent';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.permission_key IN ('dashboard.read', 'audit.read')
WHERE r.role_key = 'read_only_analyst';
