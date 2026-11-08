# PropFlow data storage architecture

## Purpose and status

This document describes PropFlow's staff-capable data model. The backend now
uses self-hosted or managed PostgreSQL through `pg`. It creates
`staff_profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`,
and `staff_role_requests` tables, and staff API routes enforce assigned
permissions. Existing admin accounts are assigned the Owner role at startup.

The authoritative PostgreSQL schema is the versioned migration in
`backend/src/migrations/`; the earlier SQLite database is imported with the
one-time tool described in
[MIGRATING-TO-POSTGRES.md](./MIGRATING-TO-POSTGRES.md).
Email ownership verification and staff invitations are not implemented.

## Goals

- Keep one login identity for each person, regardless of whether they are a
  customer, a staff member, or both.
- Give staff access only through explicit, auditable permissions.
- Store optional staff-specific details separately from shared account data.
- Preserve existing property, KYC, appointment, and audit relationships to
  `users.id`.
- Avoid collecting HR or personal data that the application does not need.

## Conceptual model

```text
users
  | 1
  |------ 0..1 staff_profiles
  |                 |
  |                 +---- manager_user_id -> staff_profiles.user_id
  |
  +------< user_roles >------ roles
                                |
                                +------< role_permissions >------ permissions

staff_invites ------ invited_by -> users
       |
       +------------ accepted_by -> users (after acceptance)

staff_role_requests -- user_id -> users
                    -- role_id -> roles
                    -- reviewed_by -> users

properties, appointments, compliance_docs, audit_logs, ...
  └── retain their existing user references to users.id
```

`users` remains the canonical identity table. A staff profile is optional and
does not, by itself, grant access. Staff-only API access requires an assigned
role whose permissions authorize the requested action.

## Tables and responsibilities

### `users` — shared sign-in identity

Keep fields needed by all account types here:

- Stable primary key `id`, referenced by application records.
- Normalized, unique email address.
- Password hash or external identity-provider identifier.
- Display name and other basic account contact fields.
- Account active/disabled status and account timestamps.

Do not copy email, password credentials, or shared identity fields into
`staff_profiles`. A user may be both a platform member and a staff member;
staff status should not require a second login account.

During a staged transition, the current `role` column may remain for
compatibility. Once authorization has been moved and verified, remove it as
the source of staff privileges; do not let the old `role='admin'` check and
the new permission checks disagree.

### `staff_profiles` — optional staff-only details

Use `user_id` as both the primary key and a foreign key to `users.id`, making
the relationship one-to-one. Suitable fields are:

- `job_title` — optional organizational title; this is descriptive, not an
  authorization grant.
- `team` or `department` — optional grouping used by staff workflows.
- `manager_user_id` — optional reference to another staff profile, if
  reporting relationships are needed.
- `employment_status` — for example `active`, `on_leave`, or `departed`, if
  those states affect staff access or workflows.
- `created_at` and `updated_at`.

Do not put payroll, home address, government identifiers, or other HR data
here unless PropFlow has a clear, approved need and suitable privacy controls.
When a staff member leaves, deactivate the shared account and revoke staff
roles; retain audit records according to the retention policy.

### `roles` and `permissions` — authorization catalog

Store stable role and permission keys rather than relying on UI labels:

- `roles`: role key, display name, description, and whether it is a
  system-defined role.
- `permissions`: permission key and description, such as
  `listings.review`, `kyc.review`, `users.deactivate`,
  `staff.manage_roles`, and `audit.read`.
- `role_permissions`: many-to-many mapping of roles to permissions.
- `user_roles`: many-to-many mapping of staff users to assigned roles, with
  assignment time and the user who granted the role.

Use a unique constraint on each role/permission key and composite primary
keys on the mapping tables to prevent duplicate assignments. Index mapping
tables by both sides of their relationships.

An initial role catalog could include:

| Role key | Typical permissions |
|---|---|
| `owner` | All staff permissions, including managing staff and roles |
| `listing_moderator` | View moderation queue; approve, reject, or feature listings |
| `compliance_reviewer` | Review KYC submissions and record review decisions |
| `support_agent` | Limited user lookup and support-related appointment actions |
| `read_only_analyst` | Read approved reports and dashboards without write access |

These are starting points, not fixed job titles. Review the actual tasks and
data exposure before assigning permissions. In particular, access to KYC
documents should be narrower than ordinary account lookup. Avoid creating a
role that bundles unrelated high-impact actions for convenience.

For staff-only functions, the API should check the required permission on
every request. Hiding a button in the frontend is not authorization. Resolve
permissions from current database state (or use a cache with a defined
invalidation strategy) so role changes and deactivation take effect promptly.

### `staff_invites` — controlled staff onboarding

Keep invitations separate from accepted staff profiles. A suitable record
contains:

- Invitee email in normalized form and the role to grant on acceptance.
- Inviting user and creation timestamp.
- Hash of a random, single-use invitation token; never store the raw token.
- Expiration, acceptance, and revocation timestamps.
- The accepted `user_id`, once the invite is redeemed.

Invitation creation and acceptance must be authenticated and audited.
Acceptance should verify the token, expiry, email ownership, and invite state
before creating or reusing a user, adding a staff profile, and assigning the
approved role in one transaction. Revoke or expire unused invitations.

An organization-controlled email-domain allowlist can be an extra invitation
guardrail, but it must not automatically grant staff access. The role should
be explicitly selected by an authorized inviter.

### `staff_role_requests` — owner-reviewed requests

The current implementation records the requesting user, requested role,
justification, request status, reviewer, review time, and optional review
note. Users may request predefined roles other than Owner from the
`/staff/request-access` deep link when their account email ends in
`@negobrick.com`. A partial unique index allows at most one pending request
per user and role. Approval creates the staff profile if needed and assigns
the role in the same transaction that marks the request approved.

The current domain check only compares the email string; it does not prove
the user controls that mailbox. Role grants remain owner-approved, but
company email verification or SSO is needed before treating domain
eligibility as an identity guarantee.

### Existing application data

Keep the current business tables and their relationships unless a separate
schema change is justified:

- `properties.seller_id` references `users.id`.
- `interests` and `appointments` reference their related users and properties.
- `compliance_docs.user_id` and `reviewed_by` reference `users.id`.
- `audit_logs.actor_id` references `users.id`.
- `property_images` references `properties.id`.

KYC document files are not database rows containing file contents. Store
documents in private, durable file/object storage and keep only protected
metadata and storage references in the database. Do not make KYC files
publicly accessible.

Audit records should identify the actor, action, affected entity, timestamp,
and relevant context. Record staff invitations, role grants/revocations,
account deactivation, listing decisions, and KYC decisions. Restrict changes
to audit records and avoid including passwords, tokens, or unnecessary KYC
details in audit metadata.

## PostgreSQL schema

The versioned migration creates the shared user identity, property and
compliance tables, staff profiles, role catalog, permissions, role
assignments, pending staff-role requests, foreign keys, and indexes. It also
seeds the predefined role/permission catalog. Treat
`backend/src/migrations/001_initial_schema.sql` as the schema source of truth;
future schema changes should use a new numbered migration.

## Security and operational rules

- No public registration path may create a staff profile or assign a staff
  role.
- Only an `owner` (or a specifically authorized staff administrator) may
  invite staff or change staff roles.
- Protect the last active `owner` from accidental removal or deactivation.
  Enforce this in a transaction and test concurrent role changes.
- Keep the number of owners small; require MFA for staff, especially owners,
  when the authentication system supports it.
- Require server-side permission checks on staff API routes and deny access
  by default.
- Use least privilege for database credentials and keep secrets outside
  source control.
- Use TLS for remote PostgreSQL connections and restrict network access to
  the database.
- Back up and test restores for the database and separately for uploads.

## Operational follow-ups

Before production cutover, rehearse the SQLite backup/import and restore
process in staging, verify table counts and core API flows, and migrate
`backend/uploads/` separately. The current staff workflow uses role requests
and owner approval; invitations, email ownership verification, and MFA remain
future work. See the migration guide for cutover and recovery requirements.

## Decisions to make before implementation

- Whether staff may also use customer/member features under the same account.
- The exact permission matrix for each staff role.
- Whether a staff member may hold multiple roles.
- Whether invitations may target only approved email domains, and how the
  app will verify control of a company mailbox or use company SSO.
- Staff MFA, session expiry, and account-recovery requirements.
- Audit and staff-profile retention requirements.
- Whether job title, team, manager, and employment status are needed at all.
