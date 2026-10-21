#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-172.105.22.18}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/propflow-staging}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
COMPOSE_FILES="-f compose.yaml -f compose.staging.yaml"
COMPOSE_ENV="--env-file .env.staging"
COMPOSE_PROJECT="propflow-staging"

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
    echo "Required local command not found: $command" >&2
    exit 2
  fi
done

echo "Checking remote Docker Compose prerequisites..."
ssh -p "$SSH_PORT" "$REMOTE" \
  "command -v docker >/dev/null && docker compose version >/dev/null && mkdir -p '$DEPLOY_PATH'" || {
  echo "Remote Docker Compose is unavailable or $DEPLOY_PATH cannot be created." >&2
  echo "Run initial-setup.sh with DEPLOY_PATH='$DEPLOY_PATH' first." >&2
  exit 1
}

echo "Syncing project files for the isolated staging stack..."
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete -e "ssh -p $SSH_PORT" \
    --exclude '/.git/' \
    --exclude '/deploy.sh' \
    --exclude '/deploy-dev.sh' \
    --exclude '/deploy-staging.sh' \
    --exclude '/initial-setup.sh' \
    --exclude '/.env' \
    --exclude '/.env.dev' \
    --exclude '/.env.staging' \
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
    --exclude=initial-setup.sh \
    --exclude=.env \
    --exclude=.env.dev \
    --exclude=.env.staging \
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
  "cd '$DEPLOY_PATH' && test -f .env.staging"; then
  ssh -p "$SSH_PORT" "$REMOTE" \
    "cd '$DEPLOY_PATH' && cp .env.staging.example .env.staging && chmod 600 .env.staging"
  echo "Created $DEPLOY_PATH/.env.staging. Set a strong staging JWT_SECRET and ADMIN_PASSWORD, then rerun this script." >&2
  exit 1
fi

if ssh -p "$SSH_PORT" "$REMOTE" \
  "cd '$DEPLOY_PATH' && grep -Eq '^(JWT_SECRET=replace-with-a-long-random-secret|ADMIN_PASSWORD=replace-with-a-unique-strong-password)$' .env.staging"; then
  echo "Replace the example JWT secret and admin password in $DEPLOY_PATH/.env.staging before deploying." >&2
  exit 1
fi

echo "Building and starting the isolated staging stack..."
ssh -p "$SSH_PORT" "$REMOTE" \
  "cd '$DEPLOY_PATH' && chmod 600 .env.staging && docker compose -p '$COMPOSE_PROJECT' $COMPOSE_ENV $COMPOSE_FILES up -d --build --remove-orphans --wait --wait-timeout 120"

echo "Checking staging services..."
ssh -p "$SSH_PORT" "$REMOTE" \
  "cd '$DEPLOY_PATH' && docker compose -p '$COMPOSE_PROJECT' $COMPOSE_ENV $COMPOSE_FILES ps"

echo "Staging deployment ready at http://$DEPLOY_HOST:8081"
