# Docker + GitHub Actions CI/CD Deployment Design

Date: 2026-08-22

## Goal

Deploy the Roster Creator app (React/Vite frontend, Node/Express/Prisma backend,
Postgres) to a single Oracle Cloud Ubuntu VM (ARM Ampere A1, 4 cores / 24GB RAM)
using Docker, with GitHub Actions handling CI (tests) and CD (build, publish,
deploy) on every push to `master`.

Domain: `taoxiong.site` (root domain reserved for future unrelated services).
This app uses two subdomains:
- `roster.taoxiong.site` — frontend
- `roster-api.taoxiong.site` — backend API

## Architecture

Three containers, orchestrated by `docker compose` on the VM:

```
Internet ──80/443──▶ [proxy: Caddy]
                        │  roster.taoxiong.site      → serves frontend static files (SPA)
                        │  roster-api.taoxiong.site  → reverse_proxy → backend:4000
                        ▼
                     [backend: Node/Express + Prisma] ──▶ [db: Postgres 16]
```

- **proxy** (Caddy): single image containing the built frontend static assets
  plus the Caddy binary. Caddy automatically obtains and renews Let's Encrypt
  certificates for both subdomains (requires DNS to already point at the VM).
  Only this container binds host ports 80/443.
- **backend** (Node/Express + Prisma): runs `prisma migrate deploy` on
  container start, then starts the server. Not exposed to the host — only
  reachable from `proxy` over the compose network.
- **db** (Postgres 16): data persisted in a named Docker volume. Not exposed
  to the host.

**Out of scope / known limitations (deliberate, revisit later if needed):**
- No automated Postgres backups yet — data safety relies solely on the
  `pgdata` volume surviving container recreation.
- Only one process can bind host ports 80/443. If future unrelated services
  on this VM also need automatic HTTPS, they'll need to either join this same
  Caddy config or run on different ports — not solved here.

## Repository layout (new files)

```
backend/Dockerfile
proxy/Dockerfile
proxy/Caddyfile
docker-compose.yml
.github/workflows/deploy.yml
.dockerignore          (root, and one inside backend/ and frontend/ if needed)
```

## Backend image (`backend/Dockerfile`)

Multi-stage build, kept simple over minimal: the runtime stage keeps the full
`node_modules` (including `prisma`, a devDependency) rather than pruning to
production-only deps, because `prisma migrate deploy` needs the Prisma CLI
available at container start. Image size is not a concern at this project's
scale.

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY backend/package.json ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

`backend/.dockerignore`: `node_modules`, `.env`, `*.log`

## Proxy image (`proxy/Dockerfile`)

Builds the frontend, then bundles the static output into a Caddy image.

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv/frontend
COPY proxy/Caddyfile /etc/caddy/Caddyfile
```

`VITE_API_BASE_URL` is a **build-time** arg (Vite bakes it into the static
bundle) — set to `https://roster-api.taoxiong.site` in the GitHub Actions
build step.

## `proxy/Caddyfile`

```
roster.taoxiong.site {
    root * /srv/frontend
    file_server
    try_files {path} /index.html
}

roster-api.taoxiong.site {
    reverse_proxy backend:4000
}
```

Caddy auto-provisions TLS via Let's Encrypt for both site blocks the first
time it starts, using the ACME HTTP-01 challenge on port 80. This requires
DNS for both subdomains to already resolve to the VM's public IP.

## `docker-compose.yml` (production, lives on the VM and in the repo root)

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    image: ghcr.io/taoxiong05/roster_creator-backend:latest
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy

  proxy:
    image: ghcr.io/taoxiong05/roster_creator-proxy:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

`.env` on the VM (never committed) holds: `DATABASE_URL`, `JWT_SECRET`,
`PORT`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_CALLBACK_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — written by the deploy
job from GitHub Secrets each run (see below), so it's always in sync with
the repo's expectations.

Note `DATABASE_URL` inside `.env` must point at the compose service name:
`postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`.
`FRONTEND_URL` must be `https://roster.taoxiong.site` (used for CORS).
`GOOGLE_CALLBACK_URL` must be `https://roster-api.taoxiong.site/auth/google/callback`.

## GitHub Actions workflow (`.github/workflows/deploy.yml`)

Triggers on push to `master` (tests also run on PRs). Three jobs:

### 1. `test`
Runs on every push and PR.
- Backend: `npm ci`, `npm test` (vitest)
- Frontend: `npm ci`, `npm test` (vitest), `npm run build` (tsc type-check + vite build)

### 2. `build-and-push`
Runs only on push to `master`, needs `test` to pass.
- `docker/setup-qemu-action` + `docker/setup-buildx-action` (cross-compile for `linux/arm64` from the amd64 runner)
- Log in to `ghcr.io` using `GITHUB_TOKEN` (automatic, needs `packages: write` permission on the job)
- Build & push `backend` image: `platforms: linux/arm64`, tags `ghcr.io/taoxiong05/roster_creator-backend:latest` and `:<sha>`
- Build & push `proxy` image: same, with `build-args: VITE_API_BASE_URL=https://roster-api.taoxiong.site`

### 3. `deploy`
Needs `build-and-push`.
- scp `docker-compose.yml` and `proxy/Caddyfile` (if changed) to the VM's deploy directory (`/opt/roster-creator`) — keeps the server's compose file in sync with the repo
- Via SSH (`appleboy/ssh-action`, using `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` secrets), render `/opt/roster-creator/.env` (heredoc) from two sources: values pulled straight from GitHub Secrets (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`), plus values that are deterministic given the domain and therefore hardcoded directly in the workflow step rather than stored as secrets: `PORT=4000`, `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`, `FRONTEND_URL=https://roster.taoxiong.site`, `GOOGLE_CALLBACK_URL=https://roster-api.taoxiong.site/auth/google/callback`. Then run:
  ```
  cd /opt/roster-creator
  docker compose pull
  docker compose up -d
  docker image prune -f
  ```

## GitHub Secrets required

| Secret | Purpose |
|---|---|
| `SSH_HOST` | VM public IP |
| `SSH_USER` | deploy SSH user |
| `SSH_PRIVATE_KEY` | private key matching a public key in the VM's `authorized_keys` |
| `POSTGRES_USER` | db user |
| `POSTGRES_PASSWORD` | db password |
| `POSTGRES_DB` | db name |
| `JWT_SECRET` | backend JWT signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `RESEND_API_KEY` | transactional email |
| `RESEND_FROM_EMAIL` | transactional email sender |

`GITHUB_TOKEN` is automatic (no manual secret) but the workflow needs
`permissions: packages: write` for the ghcr.io push job.

## Server one-time setup (Oracle Cloud Ubuntu VM)

Run once, before the first deploy:

1. **DNS**: add A records `roster.taoxiong.site` and `roster-api.taoxiong.site`
   pointing at the VM's public IP.

2. **Oracle Cloud Security List**: in the OCI console, add ingress rules for
   TCP 80 and 443 (0.0.0.0/0) on the VM's subnet — easy to miss since only 22
   is open by default.

3. **Host firewall (iptables)**: Oracle's Ubuntu images ship with restrictive
   iptables rules by default, separate from the OCI Security List. Both must
   allow 80/443, or Caddy's ACME challenge and all HTTP/HTTPS traffic will be
   silently dropped even with the Security List open.
   ```bash
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save   # or: sudo apt install iptables-persistent
   ```

4. **Deploy directory**:
   ```bash
   sudo mkdir -p /opt/roster-creator
   sudo chown $USER:$USER /opt/roster-creator
   ```

5. **Deploy SSH key** (generate locally, not on the VM):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f roster_deploy_key -N ""
   ```
   Append `roster_deploy_key.pub` to the VM's `~/.ssh/authorized_keys` for the
   deploy user. Paste the **private** key contents into the `SSH_PRIVATE_KEY`
   GitHub Secret.

6. **Docker group membership** (so the deploy user can run `docker compose`
   without `sudo`):
   ```bash
   sudo usermod -aG docker $USER
   # log out and back in for group change to take effect
   ```

7. **ghcr.io login on the VM** (needed since `docker compose pull` must
   authenticate to pull images — GHCR images inherit the repo's visibility,
   private by default for a private repo):
   ```bash
   # Create a GitHub PAT with `read:packages` scope, then:
   echo "<PAT>" | docker login ghcr.io -u TaoXiong05 --password-stdin
   ```
   This only needs to run once; Docker persists the credential in
   `~/.docker/config.json`.

## Migration handling

`prisma migrate deploy` runs automatically as part of the backend
container's startup command, before the server starts listening. No manual
or CI-triggered migration step. This means every deploy applies any new
migrations in the repo automatically; if a migration fails, the container
will exit and `restart: unless-stopped` will keep retrying until fixed.

## Testing gate

The `build-and-push` and `deploy` jobs both depend on `test` passing, so a
broken test suite blocks deployment entirely — nothing reaches production
without vitest (backend + frontend) and the frontend's `tsc` type-check
passing first.
