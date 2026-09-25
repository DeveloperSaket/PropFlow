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
| **Buyer** | Browse/filter approved listings, express interest, request viewings, track everything on a personal dashboard, submit KYC |
| **Seller** | Create/edit/delete listings (KYC-gated), manage buyer leads, confirm viewings, mark sold, submit KYC |
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
ADMIN_EMAIL=admin@propflow.test
ADMIN_PASSWORD=Admin@12345
```
An admin account is auto-created on first boot if none exists.
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
### Properties
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/properties` | optional | Search w/ filters: `q,type,listing,city,state,minPrice,maxPrice,bedrooms,sort,page,limit`; `mine=1` for a seller's own; `status=` for admin/owner |
| GET | `/properties/:id` | optional | Single listing (non-approved only visible to owner/admin) |
| POST | `/properties` | seller + KYC | Create (enters `pending`; `saveDraft:true` for draft) |
| PUT | `/properties/:id` | seller/admin | Update (seller edits re-enter review) |
| PATCH | `/properties/:id/sold` | seller/admin | Mark sold |
| DELETE | `/properties/:id` | seller/admin | Delete |
### Interests (leads)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/interests` | buyer | Express interest |
| GET | `/interests/mine` | buyer | Buyer's tracked interests |
| GET | `/interests/received` | seller | Leads on the seller's listings |
| PATCH | `/interests/:id/status` | seller/buyer | Seller updates lead; buyer can `withdrawn` |
### Appointments (viewings)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/appointments` | buyer | Request a viewing |
| GET | `/appointments/mine` | token | Role-aware list |
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