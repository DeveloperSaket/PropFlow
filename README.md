# PropFlow — Compliant Property Marketplace
A full-stack platform connecting **property sellers** and **buyers**, with a
**platform-owner (admin)** back office and built-in **compliance** (KYC
verification, listing approval, and an immutable audit trail).
- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** SQLite (via Node's built-in `node:sqlite` — zero native build)
- **Auth:** JWT (stateless), bcrypt password hashing, role-based access control
---
## 1. Roles & capabilities
| Role | Can do |
|------|--------|
| **Member** | Every regular account can browse/filter approved listings, express interest, request viewings, create/manage its own listings (KYC-gated), manage leads, and submit KYC. |
| **Admin (platform owner)** | Dashboard metrics, approve/reject listings, verify/reject KYC, activate/deactivate users, view all appointments, read the audit log |
## 2. Compliance features
1. **KYC verification** — members upload ID documents; admin reviews. Members **cannot publish** a listing until `kyc_status = verified` (`requireKyc` middleware).
2. **Listing moderation** — every new/edited listing enters a `pending` queue and must be **approved** by an admin before it is publicly visible.
3. **Audit trail** — registrations, logins, listing changes, approvals, KYC reviews, interests and appointments are written to `audit_logs` and surfaced in the admin UI.
4. **Terms acceptance** — recorded at registration (`terms_accepted_at`).
5. **Account controls** — admins can deactivate accounts; deactivated users are blocked at auth time.
---
## 3. Quick start
Requires **Node 22+** (uses the built-in `node:sqlite`).
```bash
# from the repo root
npm run install:all     # installs backend + frontend deps
npm run seed            # creates the DB, an admin, and demo data
npm run dev             # runs backend (:5005) and frontend (:5173) together
```
Then open **http://localhost:5173**.
> Run servers separately if you prefer:
> `npm run dev:backend` and (in another shell) `npm run dev:frontend`.

## Deploy to Linode

This repository uses Docker Compose, Caddy, and Nginx for deployment. Caddy is
the public edge proxy: it routes the production, dev, staging, and PPE hostnames
and automatically obtains and renews HTTPS certificates. Nginx runs inside
each frontend container to serve the built frontend and proxy API and uploads
requests to that environment's backend. No host-level Nginx or Certbot
installation is required.

Use an Ubuntu or Debian Linode and configure root SSH access. The initial setup
script installs Docker Engine and the Compose plugin, then syncs the project
files to the server. It does not start the application. Point DNS `A` records
for `negobrick.com`, `www.negobrick.com`, `dev.negobrick.com`,
`stg.negobrick.com`, and `ppe.negobrick.com` to the Linode. Only add `AAAA`
records if the server is reachable over IPv6. Allow inbound TCP ports 80 and
443 in the Linode firewall.

```bash
bash initial-setup.sh
```

The script defaults to `root@172.105.22.18`. It requires local Bash, `ssh`, and
`tar`; if `rsync` is installed, it uses it instead. The server needs internet
access for package installation, Docker image builds, and Caddy's certificate
issuance. After setup, set `APP_DOMAIN=negobrick.com`, a unique long
`JWT_SECRET`, a strong `ADMIN_PASSWORD`, and a notification
`LETSENCRYPT_EMAIL` in the server's private `.env`:

```bash
ssh root@172.105.22.18 'cd /opt/propflow && nano .env'
```

Keep `.env` on the server; it is excluded from sync. The application creates
its admin user on first startup. Existing accounts and uploads persist in Docker
volumes across deployments.

Once the server is prepared and `.env` is configured, deploy (or redeploy) from
a Bash environment. This starts the production app and Caddy:

```bash
bash deploy.sh
```

When local `rsync` is unavailable (as is common in Git Bash), the deployment
scripts transfer the project as a compressed tar stream over SSH instead.

The script defaults to `root@172.105.22.18`. Override with `DEPLOY_HOST` and/or
`DEPLOY_USER` if needed. Optional settings: `DEPLOY_PATH` (defaults to
`/opt/propflow`) and `SSH_PORT` (defaults to `22`). To review the running
services and logs, use `ssh root@172.105.22.18 'cd /opt/propflow && docker compose --profile edge -p propflow --env-file .env -f compose.yaml -f compose.prod.yaml ps'`
and `ssh root@172.105.22.18 'cd /opt/propflow && docker compose --profile edge -p propflow --env-file .env -f compose.yaml -f compose.prod.yaml logs -f caddy'`.

### Caddy and Nginx routing

Caddy binds public ports 80 and 443 and automatically manages HTTPS for these
domains:

| Hostname | Stack |
|----------|-------|
| `negobrick.com`, `www.negobrick.com` | Production |
| `dev.negobrick.com` | Development |
| `stg.negobrick.com` | Staging |
| `ppe.negobrick.com` | PPE (pre-production) |

All frontend containers join a shared Docker network that is not published to
the host. Caddy proxies to the matching frontend's Nginx container over that
network; the frontend Nginx serves the SPA and forwards `/api/` and `/uploads/`
to its own backend. Dev, staging, and PPE also publish separate HTTP ports for
direct IP testing: `8080`, `8081`, and `8082` respectively. Production has no
direct host port and is reached through Caddy. The backends and databases
remain isolated in their environment-specific Compose projects and volumes.

For IP-based testing without DNS configured, use:

| Environment | Direct HTTP test URL |
|-------------|----------------------|
| Dev | `http://172.105.22.18:8080` |
| Staging | `http://172.105.22.18:8081` |
| PPE | `http://172.105.22.18:8082` |

These ports are published on the server's network interfaces and are plain
HTTP. Allow them through the firewall only while needed; ideally restrict
access to your IP address. Set `IP_TEST_HOST` in each environment's `.env` file
if the server's public IP differs from `172.105.22.18`. The host-port mappings
do not change Caddy's ports or hostname-based HTTPS routing.

The first deployment creates the shared `propflow-proxy` Docker network. Deploy
production with `deploy.sh` to start Caddy; deploy the other environments with
their scripts. Caddy requests certificates when the configured domains resolve
to the server and ports 80 and 443 are reachable. Certificate data persists in
the production Compose volumes across container restarts.

### Development deployment with demo data

The dev deployment uses its own Compose project and database/uploads volumes.
It runs `npm run seed` inside the backend container only on the first
deployment, so ordinary redeployments preserve test changes and do not add
duplicate demo appointments. It is available at `https://dev.negobrick.com` or
for direct HTTP testing at `http://172.105.22.18:8080`.
To deliberately reset dev data, remove the `propflow-dev` Docker volumes before
redeploying; this permanently deletes dev test data. Use the demo member
accounts listed below; the dev admin credentials are the `ADMIN_EMAIL` and
`ADMIN_PASSWORD` values in `.env.dev`.

On a fresh Linode, initialize the dev path once (Docker installation is shared
with production):

```bash
DEPLOY_PATH=/opt/propflow-dev bash initial-setup.sh
```

Run `deploy-dev.sh` once to sync the files and create
`/opt/propflow-dev/.env.dev` from the example template; it stops before starting
the app. Set a strong dev `JWT_SECRET` and `ADMIN_PASSWORD` in that file, then
run it again to build, seed, and start the dev stack:

```bash
bash deploy-dev.sh
ssh root@172.105.22.18 'cd /opt/propflow-dev && nano .env.dev'
bash deploy-dev.sh
```

Set `APP_DOMAIN=dev.negobrick.com` in `/opt/propflow-dev/.env.dev`. The script
defaults to `root@172.105.22.18`; set `DEPLOY_PATH=/opt/propflow-dev` when
running `deploy-dev.sh` if using a non-default path. Do not use production
credentials or real user data.

The deployment serves `/uploads` the same way the current backend does: uploaded
KYC documents are publicly accessible by URL. Do not store real identity
documents in this deployment until that route is protected with authorization
or replaced with private object storage. Firebase-backed chat also requires
Firebase web configuration and backend Application Default Credentials; those
credentials must be securely mounted into the backend container before enabling
it in production.

### Staging deployment with demo data

The staging deployment uses its own Compose project, database/uploads volumes,
and the same seed script as dev. It is available at `https://stg.negobrick.com`
or for direct HTTP testing at `http://172.105.22.18:8081`.
The seed runs only on the first deployment, creating demo members, listings,
interests, and appointments. Set a unique staging `ADMIN_EMAIL` and strong
`ADMIN_PASSWORD` in `.env.staging`; don't use production credentials here.

On a fresh server, initialize the staging path once (Docker installation is
shared with other deployments):

```bash
DEPLOY_PATH=/opt/propflow-staging bash initial-setup.sh
```

Run `deploy-staging.sh` once to sync files and create
`/opt/propflow-staging/.env.staging`; it stops before starting the app. Edit
that file on the server to set a unique staging `JWT_SECRET` and admin
credentials, set `APP_DOMAIN=stg.negobrick.com`, then run the script again:

```bash
bash deploy-staging.sh
ssh root@172.105.22.18 'cd /opt/propflow-staging && nano .env.staging'
bash deploy-staging.sh
```

The script defaults to `/opt/propflow-staging`; set `DEPLOY_PATH` when using a
different path. Staging data persists in its own Docker volumes between
deployments. Remove those volumes only when you intentionally want to erase
staging data and allow the seed to run again.

### PPE deployment without demo data

PPE (pre-production) uses the production Compose services and Nginx frontend
image, but has its own project, environment file, database, uploads,
`https://ppe.negobrick.com` hostname, and direct HTTP test URL
`http://172.105.22.18:8082`. It does not run `npm run seed`; startup
creates only the configured PPE admin account. This is intended for final
release checks with production-like configuration, not production data.

On a fresh server, initialize the PPE path once:

```bash
DEPLOY_PATH=/opt/propflow-ppe bash initial-setup.sh
```

Run `deploy-ppe.sh` once to create `/opt/propflow-ppe/.env.ppe` and stop. Set
`APP_DOMAIN=ppe.negobrick.com`, a unique `JWT_SECRET`, and PPE-only admin
credentials, then deploy again:

```bash
bash deploy-ppe.sh
ssh root@172.105.22.18 'cd /opt/propflow-ppe && nano .env.ppe'
bash deploy-ppe.sh
```

PPE data persists independently in its own Docker volumes. Do not connect PPE
to the production database or reuse production secrets.

### Demo accounts (created by `npm run seed`)
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
PORT=5005
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=7d
DB_PATH=./data/propflow.db
CORS_ORIGIN=http://localhost:5173
FIREBASE_PROJECT_ID=<your Firebase project ID>
# Keep this service-account JSON outside the repository.
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/path/firebase-service-account.json
ADMIN_EMAIL=admin@propflow.test
ADMIN_PASSWORD=Admin@12345
```
An admin account is auto-created on first boot if none exists.

### Agent classification
Regular accounts are stored as `member` and can both buy and list properties. Admin is a separate account type. Agent status is a separate flag that admins can apply to an identified member from the Users table.

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
│   │   ├── db.js              # SQLite connection + schema
│   │   ├── bootstrap.js       # auto-create admin
│   │   ├── seed.js            # demo data
│   │   ├── middleware/        # auth (authenticate/requireRole/requireKyc), error handler
│   │   ├── routes/            # auth, properties, interests, appointments, compliance, admin
│   │   └── utils/             # auth (jwt/bcrypt), audit, validation
│   ├── data/                  # sqlite db file (gitignored)
│   └── uploads/               # KYC documents (gitignored)
└── frontend/
    └── src/
        ├── api/client.js      # fetch wrapper + JWT
        ├── context/AuthContext.jsx
        ├── components/        # PropertyCard, UI helpers
        └── pages/             # Home, Browse, PropertyDetail, Login, Register,
                               # Kyc, Buyer/Seller/Admin dashboards, PropertyForm
```
---
## 6. API reference (prefix `/api`)
### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register buyer/seller (requires `acceptTerms`) |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | token | Current user |
| GET | `/auth/firebase-token` | token | Mint a Firebase custom token for the current user |
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