# MOHAMED SHAWKI ERP - Production Deployment

## Readiness Baseline

- Runtime: Node.js 22 LTS
- Framework: Next.js 16
- Database: PostgreSQL 16
- ORM: Prisma 6
- Recommended deployment: Docker Compose on a Linux VPS
- Application port: `3040`
- Health endpoint: `/api/health`

The production server should start with a new PostgreSQL database. The migration baseline in
`prisma/migrations/20260521122212_init` is generated from the current Prisma schema. The local development
database was historically managed with `prisma db push`, so do not run `migrate deploy` against that existing
local database without first backing it up and baselining its migration history.

## Required Environment Variables

Create `.env.production` from `.env.production.example` and replace every placeholder:

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: random secret of at least 32 characters.
- `NEXT_PUBLIC_APP_NAME`: public application name.
- `APP_URL`: public HTTPS URL.
- `UPLOAD_DIR`: persistent upload directory.

Never commit `.env`, `.env.local`, or `.env.production`.

## Local Production Verification

```powershell
Set-Location "C:\path\to\apps\erp"
npm install
npx prisma validate
npx prisma generate
node scripts\audit-production-readiness.js
node scripts\check-env-production.js
node scripts\check-auth-permissions.js
node scripts\check-mojibake.js
npm run typecheck
npm run build
npm start
```

Open `http://127.0.0.1:3040/api/health`. A healthy response contains `ok: true` and `database: true`.

## Windows Deployment Scripts

```powershell
.\deploy\Deploy-Windows.ps1
.\deploy\Deploy-Windows.ps1 -Apply -RunMigrations
npm start
.\deploy\Smoke-Test.ps1 -BaseUrl "http://127.0.0.1:3040"
```

Create a full release ZIP without `.env`, uploads, logs, caches, or local backups:

```powershell
.\scripts\package-production-release.ps1
```

Create a PostgreSQL backup using the `DATABASE_URL` environment variable:

```powershell
.\deploy\Backup-Postgres.ps1 -OutputDirectory "C:\ERPBackups"
```

## Fresh Database Setup

Use this only on a new production database:

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

Do not use `prisma migrate dev` in production. Do not use `prisma db push` on a populated production database.

## Docker Deployment

1. Copy `.env.production.example` to `.env` on the server.
2. Replace database and secret placeholders.
3. Build and start:

```powershell
docker compose config
docker compose build --pull
docker compose up -d
docker compose exec web npx prisma migrate deploy
docker compose ps
Invoke-RestMethod http://127.0.0.1:3040/api/health
```

Uploads are stored in the `erp_uploads` volume and PostgreSQL data in `erp_postgres`.

## First Login

Use an existing active Admin account. Do not distribute the Admin account to supervisors. Supervisor accounts
must have role `SUPERVISOR`, a city/project scope, and a linked `Supervisor` record. Reset temporary passwords
from `/users` and hand them to users through a secure channel.

## Database Backup

Run before every deployment and schedule daily backups:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$env:PGPASSWORD = "REPLACE_AT_RUNTIME"
pg_dump --host 127.0.0.1 --port 5432 --username erp_user --format custom --file "backup-$stamp.dump" mohamed_shawki_erp
Remove-Item Env:PGPASSWORD
```

Keep backups outside the application directory and test restoration regularly.

## Restart and Logs

```powershell
docker compose restart web
docker compose logs --tail 200 web
docker compose logs --tail 200 postgres
```

## Common Errors

- `AUTH_SECRET is required in production`: add a strong `AUTH_SECRET` and restart.
- Prisma `P1001`: verify PostgreSQL is running and `DATABASE_URL` is reachable.
- Prisma Windows `EPERM`: stop Node processes, remove temporary Prisma engine files, then regenerate.
- Empty operational pages: valid on a clean deployment; verify system Cities, Projects, Users, and payroll settings.
- Upload rejected: only `.xlsx`, `.xls`, and `.csv` files up to 25 MB are accepted by project imports.

## Rollback Plan

1. Stop the web service.
2. Preserve the failed release and its logs.
3. Restore the previous application image or release directory.
4. Restore the pre-deployment database backup if the release changed schema or data.
5. Start the previous release and verify `/api/health`, Admin login, projects, vehicles, reports, and payroll.

Never run cleanup, reset, repair, or seed scripts on production unless their dry-run output was reviewed and the
script requires an explicit `--apply` and confirmation token.
