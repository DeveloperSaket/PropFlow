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
| **Buyer and seller** | Every regular account can browse/filter approved listings, express interest, request viewings, create/manage its own listings (KYC-gated), manage leads, and submit KYC. The registration choice sets the initial dashboard only. |
| **Admin (platform owner)** | Dashboard metrics, approve/reject listings, verify/reject KYC, activate/deactivate users, view all appointments, read the audit log |
## 2. Compliance features
1. **KYC verification** — buyers/sellers upload ID documents; admin reviews. Sellers **cannot publish** a listing until `kyc_status = verified` (`requireKyc` middleware).
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
npm run dev             # runs backend (:4000) and frontend (:5173) together
```
Then open **http://localhost:5173**.
> Run servers separately if you prefer:
> `npm run dev:backend` and (in another shell) `npm run dev:frontend`.
### Demo accounts (created by `npm run seed`)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@propflow.test` | `Admin@12345` |
| Seller | `ravi@seller.test` | `Password@123` |
| Buyer | `anita@buyer.test` | `Password@123` |
The login screen has one-click buttons to autofill these.
---
## 4. Configuration
Copy `backend/.env.example` to `backend/.env` and adjust:
```
PORT=4000
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
Agent classification is optional and runs asynchronously after registration when the user opts in. Configure `AGENT_DETECTION_URL` to enable it. The server sends a POST request containing `{ "market": "Canada", "user": { "id", "name", "email", "phone" } }`; the provider must return `{ "is_agent": true|false }`. An optional bearer credential can be set with `AGENT_DETECTION_API_KEY`, and `AGENT_DETECTION_TIMEOUT_MS` controls the request timeout. The result is stored in `users.is_agent` and returned as a boolean in user API responses. Existing users migrate with `is_agent = false`. Without user consent, a configured URL, or a valid provider response, signup is unaffected and the flag remains false.

### Firebase chat setup
1. In Firebase Console, enable **Authentication** and create the **Cloud Firestore** database.
2. Add the Firebase web app settings to `frontend/.env.local` using the `VITE_FIREBASE_*` names. Never put a service-account key in frontend files.
3. For local backend development, create a service-account key in **Project settings → Service accounts**. Store its JSON outside this repository and set `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env`. In production, use the hosting platform's Application Default Credentials where possible.
4. Set `FIREBASE_PROJECT_ID` in `backend/.env`. The backend exchanges the existing API JWT identity for a Firebase custom token at `GET /api/auth/firebase-token`; Firebase UIDs are the string form of PropFlow user IDs.
5. Publish the participant-only Firestore rules from the repository root with `npx firebase-tools deploy --only firestore:rules --project <your-project-id>`.
6. Restart the app with `npm run dev`. Firebase sign-in runs after API login, registration, and session restoration. Chat IDs are stored as strings and message/room-summary writes are atomic.

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
  seller: ravi@seller.test / Password@123
  buyer : anita@buyer.test / Password@123