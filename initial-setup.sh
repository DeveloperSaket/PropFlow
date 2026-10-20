#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-172.105.22.18}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/propflow}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "DEPLOY_PATH must be an absolute path containing only letters, digits, '.', '_', '/', or '-'" >&2
  exit 2
fi
if [[ ! "$SSH_PORT" =~ ^[0-9]+$ ]]; then
  echo "SSH_PORT must be a port number" >&2
  exit 2
fi
for command in ssh rsync; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required local command not found: $command" >&2
    exit 2
  fi
done

echo "Installing Docker Engine, the Compose plugin, and rsync on $REMOTE..."
ssh -p "$SSH_PORT" "$REMOTE" "bash -s -- '$DEPLOY_PATH'" <<'REMOTE_SETUP'
set -euo pipefail

DEPLOY_PATH="$1"
if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run initial-setup.sh with SSH access as root (or set DEPLOY_USER=root)." >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  echo "Cannot identify the server OS; Ubuntu or Debian is required." >&2
  exit 1
fi
. /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
  echo "Unsupported server OS: $ID. This setup script supports Ubuntu and Debian." >&2
  exit 1
fi

CODENAME="${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}"
if [[ -z "$CODENAME" ]]; then
  echo "Could not determine the OS release codename." >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg rsync

install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" |
  gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

ARCH="$(dpkg --print-architecture)"
echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$ID $CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

docker --version
docker compose version
docker info >/dev/null

install -d -m 0755 "$DEPLOY_PATH"
echo "Server dependencies installed; $DEPLOY_PATH is ready."
REMOTE_SETUP

echo "Syncing the project files to $REMOTE:$DEPLOY_PATH..."
rsync -az --delete -e "ssh -p $SSH_PORT" \
  --exclude '/.git/' \
  --exclude '/.env' \
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

ssh -p "$SSH_PORT" "$REMOTE" \
  "cd '$DEPLOY_PATH' && if [ ! -f .env ]; then cp .env.example .env; fi && chmod 600 .env"

echo
echo "Initial server setup is complete. No application containers have been started."
echo "Set APP_DOMAIN, JWT_SECRET, and ADMIN_PASSWORD in:"
echo "  ssh -p $SSH_PORT $REMOTE 'cd $DEPLOY_PATH && nano .env'"
echo "Then deploy from this repository with:"
echo "  DEPLOY_HOST='$DEPLOY_HOST' DEPLOY_USER='$DEPLOY_USER' DEPLOY_PATH='$DEPLOY_PATH' SSH_PORT='$SSH_PORT' bash deploy.sh"
