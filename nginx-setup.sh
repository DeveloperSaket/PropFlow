#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-172.105.22.18}"
DEPLOY_USER="${DEPLOY_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ ! "$SSH_PORT" =~ ^[0-9]+$ ]]; then
  echo "SSH_PORT must be a port number" >&2
  exit 2
fi
if [[ ! "$LETSENCRYPT_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Set LETSENCRYPT_EMAIL to a valid email address for certificate expiry notices." >&2
  echo "Example: LETSENCRYPT_EMAIL=admin@negobrick.com bash nginx-setup.sh" >&2
  exit 2
fi
for command in ssh; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required local command not found: $command" >&2
    exit 2
  fi
done

echo "Installing Nginx and configuring HTTPS routing on $REMOTE..."
ssh -p "$SSH_PORT" "$REMOTE" "bash -s -- '$LETSENCRYPT_EMAIL'" <<'REMOTE_SETUP'
set -euo pipefail

LETSENCRYPT_EMAIL="$1"
if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run nginx-setup.sh with SSH access as root (or set DEPLOY_USER=root)." >&2
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

if ! command -v ss >/dev/null 2>&1; then
  echo "The ss command is required to check for services already using ports 80 and 443." >&2
  exit 1
fi
for port in 80 443; do
  listeners="$(ss -H -ltnp "sport = :$port")"
  if [[ -n "$listeners" ]] && grep -Evq 'users:\(\("nginx"' <<<"$listeners"; then
    echo "Port $port is already in use by a non-Nginx service:" >&2
    echo "$listeners" >&2
    echo "Deploy the updated Compose stacks to remove Caddy and free ports 80/443, then rerun nginx-setup.sh." >&2
    exit 1
  fi
done

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx

install -d -m 0755 /etc/nginx/sites-available /etc/nginx/sites-enabled
SITE_FILE=/etc/nginx/sites-available/propflow
if [[ ! -f "$SITE_FILE" ]] || ! grep -Fq 'PropFlow managed by nginx-setup.sh' "$SITE_FILE"; then
  if [[ -f "$SITE_FILE" ]]; then
    cp -a "$SITE_FILE" "$SITE_FILE.backup.$(date +%Y%m%d%H%M%S)"
  fi

  cat > "$SITE_FILE" <<'NGINX_CONFIG'
# PropFlow managed by nginx-setup.sh
server {
    listen 80;
    listen [::]:80;
    server_name dev.negobrick.com;

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name stg.negobrick.com;

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name negobrick.com www.negobrick.com;

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONFIG
fi

ENABLED_SITE=/etc/nginx/sites-enabled/propflow
if [[ -e "$ENABLED_SITE" || -L "$ENABLED_SITE" ]] &&
  [[ "$(readlink -f "$ENABLED_SITE" 2>/dev/null || true)" != "$SITE_FILE" ]]; then
  cp -a "$ENABLED_SITE" "$ENABLED_SITE.backup.$(date +%Y%m%d%H%M%S)"
fi

ln -sfn "$SITE_FILE" "$ENABLED_SITE"
nginx -t
systemctl enable --now nginx
systemctl reload nginx

certbot --nginx --non-interactive --agree-tos --redirect \
  --email "$LETSENCRYPT_EMAIL" \
  -d dev.negobrick.com \
  -d stg.negobrick.com \
  -d negobrick.com \
  -d www.negobrick.com

systemctl enable --now certbot.timer
nginx -t
systemctl reload nginx

echo "Nginx routing and HTTPS are configured for dev.negobrick.com, stg.negobrick.com, negobrick.com, and www.negobrick.com."
REMOTE_SETUP
