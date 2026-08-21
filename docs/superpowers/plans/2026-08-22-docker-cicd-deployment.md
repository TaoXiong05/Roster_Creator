# Docker + GitHub Actions CI/CD Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dockerfiles, a production `docker-compose.yml`, and a GitHub Actions workflow that build, test, publish, and deploy the Roster Creator app (frontend, backend, Postgres) to the Oracle Cloud ARM VM.

**Architecture:** Two Docker images — `backend` (Node/Express/Prisma, multi-stage build) and `proxy` (Caddy serving the built frontend static files and reverse-proxying API requests) — plus an official `postgres:16-alpine` image, wired together by `docker-compose.yml`. A three-job GitHub Actions workflow (`test` → `build-and-push` → `deploy`) builds ARM64 images, pushes them to `ghcr.io`, and deploys over SSH.

**Tech Stack:** Docker, Docker Compose, Caddy 2, GitHub Actions, `docker buildx` + QEMU (ARM64 cross-compilation), ghcr.io.

**Spec:** [docs/superpowers/specs/2026-08-22-docker-cicd-deployment-design.md](../specs/2026-08-22-docker-cicd-deployment-design.md)

## Global Constraints

- Base images: `node:20-alpine` (build/runtime for backend and frontend build stage), `postgres:16-alpine`, `caddy:2-alpine`.
- Target platform: `linux/arm64` only (Oracle Ampere A1 VM).
- Registry: `ghcr.io`, images `ghcr.io/taoxiong05/roster_creator-backend` and `ghcr.io/taoxiong05/roster_creator-proxy`, tagged `latest` and `<commit-sha>`.
- Domains: `roster.taoxiong.site` (frontend), `roster-api.taoxiong.site` (backend API).
- Docker build context for both Dockerfiles is the **repository root** (not `backend/` or `proxy/`), so `COPY` paths inside them are repo-relative.
- Backend runtime image keeps the full `node_modules` (including devDependencies) so the Prisma CLI is available for `prisma migrate deploy` at container start — deliberate simplicity tradeoff over image size, per spec.
- `docker-compose.yml` lives at the repo root and is committed; `.env` (real secrets) is never committed — already covered by the existing root `.gitignore` entry for `.env`.
- CI gate: `build-and-push` and `deploy` both depend on `test` passing; `build-and-push`/`deploy` only run on push to `master`.

---

### Task 1: Backend Docker image

**Files:**
- Create: `backend/Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Produces: a runnable image that listens on port `4000`, applies Prisma migrations from `backend/prisma/migrations` on startup, and responds `{"status":"ok"}` on `GET /health`. Later tasks (`docker-compose.yml`, GitHub Actions) reference this image by the Dockerfile path `backend/Dockerfile` and build context `.` (repo root).

- [ ] **Step 1: Create the root `.dockerignore`**

```
**/node_modules
**/dist
**/.env
**/*.log
.git
.claude
.superpowers
```

- [ ] **Step 2: Create `backend/Dockerfile`**

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

- [ ] **Step 3: Build the image**

Run (from repo root):
```bash
docker build -f backend/Dockerfile -t roster-creator-backend:test .
```
Expected: build completes successfully, ending with the image tagged `roster-creator-backend:test`.

- [ ] **Step 4: Verify the image against a real Postgres — start a test database**

```bash
docker network create roster-test-net
docker run -d --name roster-test-db --network roster-test-net \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test \
  postgres:16-alpine
```
Expected: container starts (`docker ps` shows `roster-test-db` as `Up`). Wait ~5 seconds for Postgres to finish initializing before the next step.

- [ ] **Step 5: Run the backend image against the test database**

```bash
docker run -d --name roster-test-backend --network roster-test-net -p 4000:4000 \
  -e DATABASE_URL=postgresql://test:test@roster-test-db:5432/test \
  -e JWT_SECRET=test-secret \
  -e PORT=4000 \
  -e FRONTEND_URL=http://localhost:5173 \
  roster-creator-backend:test
docker logs -f roster-test-backend
```
Expected: logs show Prisma applying all migrations from `backend/prisma/migrations` (no errors), followed by `Server listening on port 4000`. Press Ctrl+C to stop following logs once that line appears.

- [ ] **Step 6: Verify the health endpoint**

```bash
curl http://localhost:4000/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 7: Clean up test resources**

```bash
docker rm -f roster-test-backend roster-test-db
docker network rm roster-test-net
```

- [ ] **Step 8: Commit**

```bash
git add backend/Dockerfile .dockerignore
git commit -m "Add backend Docker image"
```

---

### Task 2: Proxy Docker image (Caddy + frontend static build)

**Files:**
- Create: `proxy/Dockerfile`
- Create: `proxy/Caddyfile`

**Interfaces:**
- Consumes: none from other tasks (independent build).
- Produces: a runnable image exposing ports `80`/`443`, serving the frontend static bundle at `/srv/frontend` and reverse-proxying `roster-api.taoxiong.site` to a compose service literally named `backend` on port `4000` — this name coupling is what Task 3's `docker-compose.yml` must satisfy (the compose service must be named `backend`).

- [ ] **Step 1: Create `proxy/Caddyfile`**

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

- [ ] **Step 2: Create `proxy/Dockerfile`**

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

- [ ] **Step 3: Build the image**

Run (from repo root):
```bash
docker build -f proxy/Dockerfile -t roster-creator-proxy:test \
  --build-arg VITE_API_BASE_URL=https://roster-api.taoxiong.site .
```
Expected: build completes successfully, ending with the image tagged `roster-creator-proxy:test`.

- [ ] **Step 4: Verify the frontend build was copied in**

```bash
docker run --rm roster-creator-proxy:test ls /srv/frontend
```
Expected: lists `index.html` and an `assets` directory (Vite's build output).

- [ ] **Step 5: Verify the Caddyfile is syntactically valid**

```bash
docker run --rm roster-creator-proxy:test caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```
Expected: output ends with `Valid configuration`, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add proxy/Dockerfile proxy/Caddyfile
git commit -m "Add proxy Docker image (Caddy + frontend static build)"
```

---

### Task 3: Production `docker-compose.yml`

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: image references built in Task 1 (`backend/Dockerfile`) and Task 2 (`proxy/Dockerfile`) via their published `ghcr.io` tags; the `proxy` service's Caddyfile (Task 2) expects a service literally named `backend` listening on `4000` — this compose file defines that service name.
- Produces: the file GitHub Actions (Task 6) copies to the server and runs via `docker compose pull && docker compose up -d`.

- [ ] **Step 1: Create `docker-compose.yml`**

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

- [ ] **Step 2: Validate the compose file syntax**

Create a throwaway env file (repo root `.env` is already git-ignored, so this is safe to leave and delete manually — do not commit it):
```bash
cat > .env <<'EOF'
POSTGRES_USER=test
POSTGRES_PASSWORD=test
POSTGRES_DB=test
EOF
docker compose config
```
Expected: prints the fully-resolved compose configuration with no errors (three services: `db`, `backend`, `proxy`; three volumes: `pgdata`, `caddy_data`, `caddy_config`).

- [ ] **Step 3: Remove the throwaway env file**

```bash
rm .env
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "Add production docker-compose.yml"
```

---

### Task 4: GitHub Actions workflow — `test` job

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: a workflow file with a `test` job. Task 5 and Task 6 extend this same file by adding `build-and-push` and `deploy` jobs beneath it.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Backend install
        working-directory: backend
        run: npm ci

      - name: Backend test
        working-directory: backend
        run: npm test

      - name: Frontend install
        working-directory: frontend
        run: npm ci

      - name: Frontend test
        working-directory: frontend
        run: npm test

      - name: Frontend build
        working-directory: frontend
        run: npm run build
        env:
          VITE_API_BASE_URL: https://roster-api.taoxiong.site
```

- [ ] **Step 2: Validate YAML syntax**

```bash
docker run --rm -v "$PWD:/workdir" mikefarah/yq e '.jobs | keys' /workdir/.github/workflows/deploy.yml
```
Expected: prints `- test` with no error.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add CI test job for backend and frontend"
```

---

### Task 5: GitHub Actions workflow — `build-and-push` job

**Files:**
- Modify: `.github/workflows/deploy.yml` (append job)

**Interfaces:**
- Consumes: the `test` job from Task 4 (via `needs: test`); the `backend/Dockerfile` (Task 1) and `proxy/Dockerfile` (Task 2) build contexts.
- Produces: images pushed to `ghcr.io/taoxiong05/roster_creator-backend` and `ghcr.io/taoxiong05/roster_creator-proxy`, tags `latest` and `${{ github.sha }}` — consumed by Task 6's `deploy` job (via `docker compose pull` against the `:latest` tags referenced in `docker-compose.yml`).

- [ ] **Step 1: Append the `build-and-push` job to `.github/workflows/deploy.yml`**

Add after the `test` job (same `jobs:` indentation level):

```yaml
  build-and-push:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to ghcr.io
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: backend/Dockerfile
          platforms: linux/arm64
          push: true
          tags: |
            ghcr.io/taoxiong05/roster_creator-backend:latest
            ghcr.io/taoxiong05/roster_creator-backend:${{ github.sha }}

      - name: Build and push proxy image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: proxy/Dockerfile
          platforms: linux/arm64
          push: true
          build-args: |
            VITE_API_BASE_URL=https://roster-api.taoxiong.site
          tags: |
            ghcr.io/taoxiong05/roster_creator-proxy:latest
            ghcr.io/taoxiong05/roster_creator-proxy:${{ github.sha }}
```

- [ ] **Step 2: Validate YAML syntax**

```bash
docker run --rm -v "$PWD:/workdir" mikefarah/yq e '.jobs | keys' /workdir/.github/workflows/deploy.yml
```
Expected: prints both `- test` and `- build-and-push` with no error.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add build-and-push job for ARM64 images to ghcr.io"
```

---

### Task 6: GitHub Actions workflow — `deploy` job

**Files:**
- Modify: `.github/workflows/deploy.yml` (append job)

**Interfaces:**
- Consumes: the `build-and-push` job from Task 5 (via `needs: build-and-push`); `docker-compose.yml` and `proxy/Caddyfile` (Tasks 2–3) as the files copied to the server; GitHub Secrets `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (must already exist in the repo's GitHub Secrets — set up outside this plan, per the spec's "Server one-time setup" and prior conversation).
- Produces: the completed three-job pipeline. This job's actual server-side effect cannot be verified without a live server and real secrets — verification happens on the first real deploy, not in this plan (see Step 3 below).

- [ ] **Step 1: Append the `deploy` job to `.github/workflows/deploy.yml`**

Add after the `build-and-push` job (same `jobs:` indentation level):

```yaml
  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Copy compose files to server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "docker-compose.yml,proxy/Caddyfile"
          target: "/opt/roster-creator"

      - name: Write .env and deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cat > /opt/roster-creator/.env <<EOF
            POSTGRES_USER=${{ secrets.POSTGRES_USER }}
            POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
            POSTGRES_DB=${{ secrets.POSTGRES_DB }}
            DATABASE_URL=postgresql://${{ secrets.POSTGRES_USER }}:${{ secrets.POSTGRES_PASSWORD }}@db:5432/${{ secrets.POSTGRES_DB }}
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            PORT=4000
            FRONTEND_URL=https://roster.taoxiong.site
            GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }}
            GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }}
            GOOGLE_CALLBACK_URL=https://roster-api.taoxiong.site/auth/google/callback
            RESEND_API_KEY=${{ secrets.RESEND_API_KEY }}
            RESEND_FROM_EMAIL=${{ secrets.RESEND_FROM_EMAIL }}
            EOF
            cd /opt/roster-creator
            docker compose pull
            docker compose up -d
            docker image prune -f
```

- [ ] **Step 2: Validate YAML syntax**

```bash
docker run --rm -v "$PWD:/workdir" mikefarah/yq e '.jobs | keys' /workdir/.github/workflows/deploy.yml
```
Expected: prints `- test`, `- build-and-push`, and `- deploy` with no error.

- [ ] **Step 3: Note on end-to-end verification**

This job requires a live Oracle Cloud VM reachable over SSH, GitHub Secrets populated, and the "Server one-time setup" steps from the spec (DNS, firewall, `/opt/roster-creator` directory, deploy SSH key, docker group membership, `ghcr.io` login) already done on that VM. None of that exists yet as part of this plan — the first real push to `master` after those prerequisites are in place is the actual end-to-end test. If it fails, check the Actions run logs for the failing step (SSH connection, `.env` write, or `docker compose up`).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add deploy job: SSH to server and roll out via docker compose"
```
