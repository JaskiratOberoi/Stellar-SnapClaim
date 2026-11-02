-- Roles, second cut:
--   super_admin  everything, including onboarding and offboarding people and the policy
--   admin        sees every claim in the company; approves, rejects and edits its direct reports' claims
--   approver     approves, rejects and edits its direct reports' submitted claims; files its own
--   employee     files its own claims and may withdraw one before it is decided; no edits after submission
-- The first admin becomes the super admin; directors become admins; managers become approvers.

ALTER TYPE user_role RENAME TO user_role_v1;
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'approver', 'employee');
ALTER TABLE app_user ALTER COLUMN role DROP DEFAULT;
ALTER TABLE app_user ALTER COLUMN role TYPE user_role USING (
  CASE role::text
    WHEN 'admin' THEN 'super_admin'
    WHEN 'director' THEN 'admin'
    WHEN 'manager' THEN 'approver'
    ELSE 'employee'
  END
)::user_role;
ALTER TABLE app_user ALTER COLUMN role SET DEFAULT 'employee';
DROP TYPE user_role_v1;

-- Tokens carry the role name, so every session is re-issued.
UPDATE app_user SET session_version = session_version + 1;

-- Every action anyone takes, company-wide. claim_event stays as the per-claim history.
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES company(id),
  actor_id    uuid REFERENCES app_user(id),
  actor_name  text NOT NULL DEFAULT '',
  action      text NOT NULL,            -- dotted: claim.submit, approval.reject, user.create, auth.login_failed ...
  entity_type text,                     -- claim | receipt | user | policy | category | month | session
  entity_id   text,
  summary     text NOT NULL,            -- one line a person can read
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_company_time ON audit_log(company_id, created_at DESC);
CREATE INDEX audit_log_actor_time ON audit_log(actor_id, created_at DESC);
CREATE INDEX audit_log_action ON audit_log(company_id, action);
