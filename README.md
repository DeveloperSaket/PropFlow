# PropFlow — Compliant Property Marketplace
A full-stack platform connecting **property sellers** and **buyers**, with a
**staff** back office and built-in **compliance** (KYC
verification, listing approval, and an immutable audit trail).
- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (via `pg`; self-hostable with Docker Compose)
- **Auth:** JWT sessions, bcrypt password hashing, role/permission-based access control
---
## 1. Roles & capabilities
| Role | Can do |
|------|--------|
| **Member** | Every regular account can browse/filter approved listings, express interest, request viewings, create/manage its own listings (KYC-gated), manage leads, and submit KYC. |
| **Owner / Super Admin** | Assign/revoke staff roles and approve role requests; access all staff administration |
| **Listing Moderator** | View the moderation queue; approve/reject and feature listings |
| **Compliance Reviewer** | View users and review KYC submissions |
| **Support Agent** | View users and appointments |
| **Read-only Analyst** | View dashboard metrics and audit records |

Staff permissions are backed by `staff_profiles`, `roles`, `permissions`,
`role_permissions`, and `user_roles`. The existing `users` identity remains
shared; a staff role does not create another login. Existing admin accounts
are migrated to Owner on startup. The Owner can assign predefined roles from
the staff dashboard. Logged-in users with an address ending in
`@negobrick.com` can open `/staff/request-access` and submit a role request
with a justification; an Owner must approve it before access is granted.

The current app checks the email's domain string but does **not** verify
control of that mailbox. Do not treat the domain check as proof of identity.
Add email verification or company SSO before relying on domain eligibility as
an identity guarantee.
## 2. Compliance features
1. **KYC verification** — members upload ID documents; admin reviews. Members **cannot publish** a listing until `kyc_status = verified` (`requireKyc` middleware).
2. **Listing moderation** — every new/edited listing enters a `pending` queue and must be **approved** by an admin before it is publicly visible.
3. **Audit trail** — registrations, logins, listing changes, approvals, KYC reviews, interests and appointments are written to `audit_logs` and surfaced in the admin UI.
4. **Terms acceptance** — recorded at registration (`terms_accepted_at`).
5. **Account controls** — admins can deactivate accounts; deactivated users are blocked at auth time.
---
## 3. Quick start
Requires **Node 22.15+**, npm, and Docker Compose for the local PostgreSQL
container. The application uses PostgreSQL; the SQLite import utility reads
the previous SQLite database.
```bash
# from the repo root
npm run install:all     # installs backend + frontend deps
Copy-Item .env.example .env
# Set unique random POSTGRES_PASSWORD and POSTGRES_APP_PASSWORD values.
Copy-Item backend\.env.example backend\.env
# Set DATABASE_URL with POSTGRES_APP_PASSWORD and a unique JWT_SECRET in backend/.env.
docker compose up -d postgres
Set-Location backend
npm run migrate         # apply PostgreSQL schema
npm run seed            # development only; never run against production
Set-Location ..
npm run dev             # runs backend (:5112) and frontend (:5173) together
```
Then open **http://localhost:5173**.
> Run servers separately if you prefer:
> `npm run dev:backend` and (in another shell) `npm run dev:frontend`.
### Development demo accounts (created by `npm run seed`; never seed production)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@propflow.test` | `Admin@12345` |
| Agent member | `agent@maplekey.test` | `Password@123` |
| Member | `olivia@buyer.test` | `Password@123` |
The login screen has one-click buttons to autofill these.
---
## 4. Configuration
Copy `backend/.env.example` to `backend/.env` and adjust:
```
PORT=5112
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=7d
DATABASE_URL=postgres://propflow:<URL-encoded-password>@localhost:5432/propflow
DATABASE_POOL_SIZE=10
DATABASE_SSL=false
CORS_ORIGIN=http://localhost:5173
FIREBASE_PROJECT_ID=<your Firebase project ID>
# Keep this service-account JSON outside the repository.
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/path/firebase-service-account.json
ADMIN_EMAIL=admin@propflow.test
ADMIN_PASSWORD=Admin@12345
```
In development, an admin is auto-created on first boot if none exists. In
production, configure a non-demo `ADMIN_EMAIL`, a unique `ADMIN_PASSWORD`,
and a strong `JWT_SECRET` (for example, `admin@negobrick.com`); the
server refuses to create the first admin without the admin credentials and
refuses to start without `JWT_SECRET`.

### PostgreSQL persistence and backups

The Compose service stores data in the persistent `propflow-postgres` volume
and binds port 5432 to loopback only. It creates a separate application role;
the PostgreSQL superuser credentials are for administration and backups. Do
not publish PostgreSQL directly to the public internet. For a remote
self-hosted server, restrict firewall access to the application host and
require TLS. Back up the database regularly and test restores; a Docker volume is not a backup. See
[MIGRATING-TO-POSTGRES.md](./MIGRATING-TO-POSTGRES.md) for SQLite import,
cutover, backup, and restore steps.

### Agent classification
Regular accounts are stored as `member` and can both buy and list properties.
Agent status is separate from staff access. Staff users can also be members;
staff capabilities come from assigned permissions, not the legacy account role.

### Firebase chat setup
1. In Firebase Console, enable **Authentication** and create the **Cloud Firestore** database.
2. Add the Firebase web app settings to `frontend/.env.local` using the `VITE_FIREBASE_*` names. Never put a service-account key in frontend files.
3. For local backend development, create a service-account key in **Project settings → Service accounts**. Store its JSON outside this repository and set `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env`. In production, use the hosting platform's Application Default Credentials where possible.

4. Set `FIREBASE_PROJECT_ID` in `backend/.env`. The backend exchanges the existing API JWT identity for a Firebase custom token at `GET /api/auth/firebase-token`; Firebase UIDs are the string form of PropFlow user IDs.
5. Publish the participant-only Firestore rules from the repository root with `npx firebase-tools deploy --only firestore:rules --project <your-project-id>`.
6. Restart the app with `npm run dev`. Firebase sign-in runs after API login, registration, and session restoration. Chat IDs are stored as strings and message/room-summary writes are atomic.

Firebase chat is optional. If the web configuration is missing, invalid, or
Firebase authentication cannot connect, the app displays chat as unavailable
while the rest of the app and its backend-based login continue to work. Firebase
web settings are embedded in the frontend at build time, so rebuild and redeploy
the frontend after changing them.

The backend service account is privileged. Keep it out of source control, frontend files, logs, and client responses. `.env.local` and `backend/.env` are ignored by Git.
---
## 5. Project structure
```
propflow/
├── backend/
│   ├── src/
│   │   ├── server.js          # app entry, route mounting
│   │   ├── config.js          # env config
│   │   ├── db.js              # PostgreSQL pool + migrations
│   │   ├── migrations/        # versioned PostgreSQL schema
│   │   ├── migrate-sqlite.js  # one-time SQLite data import
│   │   ├── bootstrap.js       # auto-create admin
│   │   ├── seed.js            # demo data
│   │   ├── middleware/        # auth (authenticate/requireRole/requireKyc), error handler
│   │   ├── routes/            # auth, properties, interests, appointments, compliance, admin, staff
│   │   └── utils/             # auth (jwt/bcrypt), staff access, audit, validation
│   └── uploads/               # KYC documents (gitignored)
├── compose.yaml               # self-hosted PostgreSQL service
└── frontend/
    └── src/
        ├── api/client.js      # fetch wrapper + JWT
        ├── context/AuthContext.jsx
        ├── components/        # PropertyCard, UI helpers
        └── pages/             # Home, Browse, PropertyDetail, Login, Register,
                               # Profile, Kyc, Buyer/Seller/Staff dashboards, PropertyForm
```
---
## 6. API reference (prefix `/api`)
### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register buyer/seller (requires `acceptTerms`) |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | token | Current user |
| POST | `/auth/change-password` | token + current password | Change password, rotate session version, and return a replacement JWT |
| GET | `/auth/firebase-token` | token | Mint a Firebase custom token for the current user |
| GET | `/staff/roles` | token | List requestable roles, assigned roles, and the user's request history |
| POST | `/staff/role-requests` | token + `@negobrick.com` email | Submit a role request with justification |

Signed-in users can view their account details and change their password at
`/profile`. Password changes require the current password and invalidate
previous sessions. Email-based recovery for forgotten passwords is not
available until an email delivery and verification flow is configured.
### Properties
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/properties` | optional | Search w/ filters: `q,type,listing,city,state,minPrice,maxPrice,bedrooms,sort,page,limit`; `mine=1` for a seller's own; `status=` for admin/owner |
| GET | `/properties/:id` | optional | Single listing (non-approved only visible to owner/admin) |
| POST | `/properties` | user + KYC | Create (enters `pending`; `saveDraft:true` for draft) |
| PUT | `/properties/:id` | owner/admin | Update (owner edits re-enter review) |
| PATCH | `/properties/:id/sold` | owner/admin | Mark sold |
| DELETE | `/properties/:id` | owner/admin | Delete |
### Interests (leads)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/interests` | user | Express interest |
| GET | `/interests/mine` | user | Buyer's tracked interests |
| GET | `/interests/received` | user | Leads on the user's listings |
| PATCH | `/interests/:id/status` | participant | Listing owner updates lead; interested user can withdraw |
### Appointments (viewings)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/appointments` | user | Request a viewing |
| GET | `/appointments/mine` | token | View appointments (optional `?view=buyer` or `?view=seller`) |
| PATCH | `/appointments/:id/status` | participant/admin | requested→confirmed→completed / cancelled |
### Compliance
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/compliance/kyc` | token | Upload KYC doc (multipart: `doc_type`, `document`) |
| GET | `/compliance/kyc/mine` | token | My docs + status |
### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/stats` | Dashboard metrics |
| GET | `/admin/users` | List users (`?role=`, `?kyc=`) |
| PATCH | `/admin/users/:id/kyc` | Verify/reject KYC |
| PATCH | `/admin/users/:id/active` | Activate/deactivate |
| GET | `/admin/listings/pending` | Review queue |
| PATCH | `/admin/listings/:id/review` | `{decision:'approve'|'reject', reason?}` |
| PATCH | `/admin/listings/:id/feature` | Toggle featured |
| GET | `/admin/appointments` | All appointments |
| GET | `/admin/audit` | Paginated audit log |
| GET | `/admin/staff/roles` | Owner only: list predefined roles and permissions |
| PATCH | `/admin/users/:id/staff-roles` | Owner only: assign/revoke a staff role |
| GET | `/admin/staff/role-requests` | Owner only: list pending requests |
| PATCH | `/admin/staff/role-requests/:id` | Owner only: approve/reject a request |
---
## 7. Suggested demo flow
1. Log in as **seller** → *Compliance* → upload any PDF/JPG for KYC.
2. Log in as **admin** → *Users* → **Verify KYC** for that seller.
3. Back as **seller** → *New listing* → submit (goes to `pending`).
4. As **admin** → *Review Queue* → **Approve** the listing.
5. As **buyer** → *Browse* → open the listing → **Express interest** + **Request viewing**.
6. As **seller** → *Leads* / *Viewings* → update lead status, confirm viewing.
7. As **admin** → *Audit Log* → see the full trail.
---
## 8. Production notes / next steps
- Put KYC uploads behind authZ or move to object storage (S3) with signed URLs — the demo serves `/uploads` statically for convenience.
- Add refresh tokens / token rotation and rate limiting on auth routes.
- Replace image-URL input with real file upload + CDN.
- Add email/SMS notifications for lead and appointment events.
- Add automated tests and CI; containerize with Docker.
- For higher write concurrency, consider Postgres (the SQL is standard).


  admin : admin@propflow.test / Admin@12345
  seller: agent@maplekey.test / Password@123
  buyer : olivia@buyer.test / Password@123