-- 001_schema.sql · Stellar SnapClaim · PostgreSQL 16
-- Applied once by the API at startup (recorded in sc_migration).

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS sc_migration (
  script      text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- admin: runs the company (users, policy, categories). director: month-end review + clearance.
-- manager: approves claims of their reports. employee: files claims.
CREATE TYPE user_role    AS ENUM ('admin','director','manager','employee');
-- draft → submitted → approved | rejected ; approved → cleared (director, month close)
CREATE TYPE claim_status AS ENUM ('draft','submitted','approved','rejected','cleared');
CREATE TYPE extraction_status AS ENUM ('pending','done','failed','skipped');

-- ---------------------------------------------------------------------------
-- Company and people
-- ---------------------------------------------------------------------------
CREATE TABLE company (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  currency      char(3) NOT NULL DEFAULT 'INR',
  timezone      text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES company(id),
  email           citext NOT NULL UNIQUE,
  full_name       text NOT NULL,
  employee_code   text,
  department      text,
  role            user_role NOT NULL DEFAULT 'employee',
  manager_id      uuid REFERENCES app_user(id),      -- who approves this person's claims
  password_hash   text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  session_version int NOT NULL DEFAULT 1,            -- bump to revoke every token
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_user_company_idx ON app_user(company_id);
CREATE INDEX app_user_manager_idx ON app_user(manager_id);

CREATE TABLE refresh_token (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_token_user_idx ON refresh_token(user_id);

-- ---------------------------------------------------------------------------
-- Categories and spending policy
-- ---------------------------------------------------------------------------
CREATE TABLE category (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES company(id),
  code        text NOT NULL,                        -- stable key the OCR maps to, e.g. 'meals'
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT 'receipt',
  sort_order  int NOT NULL DEFAULT 100,
  is_active   boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, code)
);

-- One row per category (or category NULL = every category). Nulls mean "no limit".
CREATE TABLE policy_rule (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES company(id),
  category_id           uuid REFERENCES category(id),
  max_per_claim         numeric(12,2),              -- a single claim above this is flagged
  max_per_month         numeric(12,2),              -- employee's running monthly total above this is flagged
  receipt_required_above numeric(12,2) NOT NULL DEFAULT 0,  -- claims above this need a receipt image
  max_days_to_submit    int,                        -- days after spend date before a claim is flagged as late
  notes                 text,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------
CREATE TABLE claim (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES company(id),
  employee_id     uuid NOT NULL REFERENCES app_user(id),
  claim_no        bigserial,                        -- human-friendly number shown in the app
  title           text NOT NULL,
  category_id     uuid REFERENCES category(id),
  vendor          text,
  spent_on        date NOT NULL,
  -- 'YYYY-MM' from the spend date; extract() is immutable, to_char() is not, so it can be a generated column.
  period          char(7) GENERATED ALWAYS AS (
                    lpad(extract(year FROM spent_on)::int::text, 4, '0') || '-' || lpad(extract(month FROM spent_on)::int::text, 2, '0')
                  ) STORED,
  currency        char(3) NOT NULL DEFAULT 'INR',
  amount          numeric(12,2) NOT NULL CHECK (amount >= 0),
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  notes           text,
  status          claim_status NOT NULL DEFAULT 'draft',
  policy_flags    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{code, message, severity}] computed at submit
  submitted_at    timestamptz,
  decided_by      uuid REFERENCES app_user(id),
  decided_at      timestamptz,
  decision_note   text,
  cleared_by      uuid REFERENCES app_user(id),
  cleared_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_employee_idx ON claim(employee_id, status);
CREATE INDEX claim_company_period_idx ON claim(company_id, period, status);
CREATE INDEX claim_company_status_idx ON claim(company_id, status, submitted_at);

CREATE TABLE claim_line (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
  sort_order  int NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity    numeric(12,3) NOT NULL DEFAULT 1,
  unit_price  numeric(12,2),
  amount      numeric(12,2) NOT NULL
);
CREATE INDEX claim_line_claim_idx ON claim_line(claim_id);

-- Receipt images live in the database so a deployment is one volume.
-- A receipt may exist before its claim (snap → extract → fill the form → save).
CREATE TABLE receipt (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES company(id),
  uploaded_by       uuid NOT NULL REFERENCES app_user(id),
  claim_id          uuid REFERENCES claim(id) ON DELETE SET NULL,
  content_type      text NOT NULL,
  byte_size         int NOT NULL,
  sha256            text NOT NULL,
  data              bytea NOT NULL,
  extraction_status extraction_status NOT NULL DEFAULT 'pending',
  extraction        jsonb,                          -- what the OCR read: vendor, date, total, tax, currency, lines, category
  extraction_error  text,
  extraction_model  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX receipt_claim_idx ON receipt(claim_id);
CREATE INDEX receipt_uploader_idx ON receipt(uploaded_by, created_at DESC);

CREATE TABLE claim_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES app_user(id),
  action      text NOT NULL,                        -- created, updated, submitted, approved, rejected, cleared, reopened
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_event_claim_idx ON claim_event(claim_id, created_at);

-- Director's month-end sign-off. Approved claims in the period become 'cleared'.
CREATE TABLE month_close (
  company_id   uuid NOT NULL REFERENCES company(id),
  period       char(7) NOT NULL,
  closed_by    uuid NOT NULL REFERENCES app_user(id),
  closed_at    timestamptz NOT NULL DEFAULT now(),
  claim_count  int NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  note         text,
  PRIMARY KEY (company_id, period)
);
