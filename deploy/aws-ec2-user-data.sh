#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/mohamed-shawki-erp"
REPO_URL="${REPO_URL:-https://github.com/DevLoay/erp_anan.git}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@logistics-erp.com}"
ADMIN_NAME="${ADMIN_NAME:-System Admin}"

log() {
  printf '[mohamed-shawki-erp] %s\n' "$*"
}

random_safe() {
  local value length
  length="${1:-32}"
  value="$(openssl rand -hex 64)"
  printf '%s' "${value:0:length}"
}

get_public_ip() {
  local token ip
  token="$(curl -fsS -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || true)"

  if [ -n "$token" ]; then
    ip="$(curl -fsS -H "X-aws-ec2-metadata-token: $token" \
      "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)"
  else
    ip="$(curl -fsS "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)"
  fi

  if [ -z "${ip:-}" ]; then
    ip="$(hostname -I | awk '{print $1}')"
  fi

  printf '%s' "$ip"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker is already installed."
    return
  fi

  log "Installing Docker Engine and Docker Compose plugin."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl git gnupg openssl

  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

ensure_swap() {
  if swapon --show | grep -q '/swapfile'; then
    log "Swap file already enabled."
    return
  fi

  log "Creating 4 GB swap file for the production build."
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
}

checkout_app() {
  mkdir -p "$APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    log "Updating existing checkout."
    git -C "$APP_DIR" fetch --depth=1 origin main
    git -C "$APP_DIR" reset --hard origin/main
  else
    log "Cloning application repository."
    rm -rf "$APP_DIR"
    git clone --depth=1 --branch main "$REPO_URL" "$APP_DIR"
  fi
}

write_env() {
  cd "$APP_DIR"
  mkdir -p public/uploads

  if [ -f .env ]; then
    log ".env already exists; keeping existing secrets."
    return
  fi

  local postgres_password auth_secret admin_password public_ip app_url
  postgres_password="$(random_safe 36)"
  auth_secret="$(openssl rand -hex 48)"
  admin_password="Admin@$(random_safe 16)"
  public_ip="$(get_public_ip)"
  app_url="${APP_URL:-http://${public_ip}:3040}"

  cat > .env <<EOF
POSTGRES_DB=mohamed_shawki_erp
POSTGRES_USER=erp_user
POSTGRES_PASSWORD=${postgres_password}
DATABASE_URL=postgresql://erp_user:${postgres_password}@postgres:5432/mohamed_shawki_erp?schema=public
AUTH_SECRET=${auth_secret}
NEXT_PUBLIC_APP_NAME=MOHAMED SHAWKI ERP
APP_URL=${app_url}
UPLOAD_DIR=/app/public/uploads
EOF

  cat > /root/mohamed-shawki-erp-credentials.txt <<EOF
Application URL: ${app_url}
Admin email: ${ADMIN_EMAIL}
Temporary admin password: ${admin_password}
PostgreSQL database: mohamed_shawki_erp
PostgreSQL user: erp_user
PostgreSQL password: ${postgres_password}
EOF
  chmod 600 /root/mohamed-shawki-erp-credentials.txt

  cat > /root/mohamed-shawki-erp-admin.env <<EOF
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_NAME=${ADMIN_NAME}
ADMIN_PASSWORD=${admin_password}
EOF
  chmod 600 /root/mohamed-shawki-erp-admin.env
}

run_app() {
  cd "$APP_DIR"
  log "Building Docker images."
  docker compose build --pull --progress=plain

  log "Starting PostgreSQL."
  docker compose up -d postgres
  for _ in $(seq 1 60); do
    if docker compose exec -T postgres pg_isready -U erp_user -d mohamed_shawki_erp >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  log "Running Prisma migrations."
  docker compose run --rm web npx prisma migrate deploy

  log "Ensuring Admin user."
  set -a
  . /root/mohamed-shawki-erp-admin.env
  set +a
  docker compose run --rm \
    -e ADMIN_EMAIL="$ADMIN_EMAIL" \
    -e ADMIN_NAME="$ADMIN_NAME" \
    -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    web node scripts/ensure-admin-user.mjs --apply --confirm=ENSURE_ADMIN_USER

  log "Starting ERP web service."
  docker compose up -d web

  log "Waiting for health endpoint."
  for _ in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:3040/api/health >/tmp/mohamed-shawki-erp-health.json; then
      break
    fi
    sleep 2
  done

  docker compose ps > /root/mohamed-shawki-erp-status.txt
  log "Done. Credentials are saved at /root/mohamed-shawki-erp-credentials.txt"
}

main() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "This script must run as root." >&2
    exit 1
  fi

  install_docker
  ensure_swap
  checkout_app
  write_env
  run_app
}

main "$@"
