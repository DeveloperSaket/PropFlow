* Deployment

Added a Linode deployment setup using Docker Compose:

- `compose.yaml` runs the backend, frontend, and the Caddy edge proxy (enabled by the production deploy script). Caddy provides HTTPS and routes production, dev, staging, and PPE hostnames to Nginx frontend containers over a shared private Docker network. SQLite data and uploads use environment-specific persistent Docker volumes.
- `deploy.sh` syncs the current working tree over SSH and rebuilds/restarts the app. On its first run, it creates the server’s `.env` from the template and stops so you can set the domain and secrets.
- `deploy-staging.sh` seeds staging with demo data on first deploy; `deploy-ppe.sh` deploys a production-like stack without demo data.
- Added the Dockerfiles, frontend Nginx/Caddy configuration, environment templates, and `.dockerignore`.
- Added setup and deployment instructions to `README.md`.

**To deploy:** provision an Ubuntu Linode with Docker Compose, configure its DNS and SSH access, then run `DEPLOY_HOST=<ip> DEPLOY_USER=<user> bash deploy.sh` from a Bash environment with `rsync`. Edit `/opt/propflow/.env` on the server after the first run, then run the command again.

**Security note:** the existing backend serves uploaded KYC documents publicly. The README calls this out; protect that route or use private storage before uploading real identity documents.

**Validation:** `npm run build` passed and `git diff --check` passed. I couldn’t validate the Docker Compose build or run the deployment script here because Docker Compose and Bash aren’t available in this environment. I did not deploy to a Linode. The pre-existing changes to `propflow.db-shm` and `propflow.db-wal` were left untouched.

** Regular Deploy

Updated `deploy.sh` to default to `root@172.105.22.18`. You can now run `bash deploy.sh` without setting `DEPLOY_HOST` or `DEPLOY_USER`; either remains overridable if needed.

Updated the Linode instructions in `README.md`. `git diff --check` passed.

** Initial Setup

Added `initial-setup.sh` and updated the Linode section in `README.md`.

Run `bash initial-setup.sh` to install Docker Engine, Docker Compose, and `rsync` on `root@172.105.22.18`, then sync the project files and create the server’s `.env` if it doesn’t exist. It **does not start the application**. After setting `APP_DOMAIN`, `JWT_SECRET`, and `ADMIN_PASSWORD` in that server-side `.env`, run `bash deploy.sh` to build and deploy.

Both scripts passed Bash syntax checks, and `git diff --check` passed. I haven’t run setup against the Linode.

** PM2

We’re **not using PM2**, and it isn’t needed for the current deployment design.

The app runs in Docker Compose, which already starts containers after reboot and restarts them if their process exits (`restart: unless-stopped` in `compose.yaml`). Docker also provides container logs, and Compose keeps the database and uploads in persistent volumes. PM2 would duplicate process management inside the backend container without adding much benefit.

One caveat: the backend health check can report that the service is unhealthy, but Docker Compose does **not** automatically restart a container just because it becomes unhealthy. It does restart it if the process exits. We could add health-based recovery if that becomes a requirement, but adding PM2 just for that isn’t necessary.

PM2 would make more sense for a **bare-metal Node deployment without Docker**, or if we decide we need a Node-specific process manager. For this Docker setup, I recommend keeping it out.