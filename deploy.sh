#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-172.105.22.18}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/propflow}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
COMPOSE_FILES="-f compose.yaml -f compose.prod.yaml"

if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "DEPLOY_PATH must be an absolute path containing only letters, digits, '.', '_', '/', or '-'" >&2
  exit 2
fi
if [[ ! "$SSH_PORT" =~ ^[0-9]+$ ]]; then
  echo "SSH_PORT must be a port number" >&2
  exit 2
fi
for command in ssh tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 2
  fi
done

echo "Checking remote deployment prerequisites..."
ssh -p "$SSH_PORT" "$REMOTE" \
  "command -v docker >/dev/null && docker compose version >/dev/null && mkdir -p '$DEPLOY_PATH'" || {
  echo "Remote Docker Compose is unavailable or $DEPLOY_PATH cannot be created." >&2
  echo "Install Docker and the Docker Compose plugin on the server first." >&2
  exit 1
}

echo "Syncing source to $REMOTE:$DEPLOY_PATH..."
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete -e "ssh -p $SSH_PORT" \
    --exclude '/.git/' \
    --exclude '/deploy.sh' \
    --exclude '/deploy-dev.sh' \
    --exclude '/deploy-staging.sh' \
    --exclude '/deploy-ppe.sh' \
    --exclude '/initial-setup.sh' \
    --exclude '/.env' \
    --exclude '/.env.dev' \
    --exclude '/.env.staging' \
    --exclude '/.env.ppe' \
    --exclude '/node_modules/' \
    --exclude '/backend/.env' \
    --exclude '/backend/data/' \
    --exclude '/backend/uploads/' \
    --exclude '/frontend/.env.local' \
    --exclude '/frontend/dist/' \
    --exclude '/*.service-account.json' \
    --exclude '/**/node_modules/' \
    --exclude '/**/data/' \
    --exclude '/**/uploads/' \
    ./ "$REMOTE:$DEPLOY_PATH/"
else
  tar -czf - \
    --exclude=.git \
    --exclude=deploy.sh \
    --exclude=deploy-dev.sh \
    --exclude=deploy-staging.sh \
    --exclude=deploy-ppe.sh \
    --exclude=initial-setup.sh \
    --exclude=.env \
    --exclude=.env.dev \
    --exclude=.env.staging \
    --exclude=.env.ppe \
    --exclude=node_modules \
    --exclude=backend/.env \
    --exclude=backend/data \
    --exclude=backend/uploads \
    --exclude=frontend/.env.local \
    --exclude=frontend/dist \
    --exclude='*.service-account.json' \
    --exclude=data \
    --exclude=uploads \
    . | ssh -p "$SSH_PORT" "$REMOTE" \
      "tar -xzf - -C '$DEPLOY_PATH'"
fi

if ! ssh -p "$SSH_PORT" "$REMOTE" \
  "cd '$DEPLOY_PATH' && test -f .env"; then
  ssh -p "$SSH_PORT" "$REMOTE" \
    "cd '$DEPLOY_PATH' && cp .env.example .env && chmod 600 .env"
  echo "Created $DEPLOY_PATH/.env from .env.example. Edit it on the Linode, then rerun this command." >&2
  exit 1
fi

if ssh -p "$SSH_PORT" "$REMOTE" \
  "cd '$DEPLOY_PATH' && grep -Eq '^(APP_DOMAIN=propflow\.example\.com|JWT_SECRET=replace-with-a-long-random-secret|ADMIN_PASSWORD=replace-with-a-unique-strong-password|LETSENCRYPT_EMAIL=replace-with-a-valid-email@example\.com)$' .env"; then
  echo "Replace the example domain, JWT secret, admin password, and Let's Encrypt email in $DEPLOY_PATH/.env before deploying." >&2
  exit 1
fi

echo "Building and restarting the application..."
ssh -p "$SSH_PORT" "$REMOTE" \
  "docker network inspect propflow-proxy >/dev/null 2>&1 || docker network create propflow-proxy"
ssh -p "$SSH_PORT" "$REMOTE" \
  "cd '$DEPLOY_PATH' && chmod 600 .env && docker compose --profile edge -p propflow --env-file .env $COMPOSE_FILES up -d --build --remove-orphans && docker compose --profile edge -p propflow --env-file .env $COMPOSE_FILES ps"

echo "Deployment complete."
