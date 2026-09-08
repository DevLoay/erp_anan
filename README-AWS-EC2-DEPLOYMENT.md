# MOHAMED SHAWKI ERP - AWS EC2 Deployment

This guide deploys the ERP on one Ubuntu EC2 instance using Docker Compose:

- Next.js web app
- PostgreSQL 16 container
- Persistent Docker volumes for database and uploads

## Required EC2 Settings

- Region: `eu-north-1`
- AMI: Ubuntu Server LTS
- Instance type: free-tier eligible small instance chosen in the AWS console
- Storage: keep the free-tier eligible default size
- Security group inbound rules:
  - SSH `22` from your IP only
  - HTTP app port `3040` from your IP first, then open wider only when needed

## User Data

Paste the content of:

```text
deploy/aws-ec2-user-data.sh
```

into EC2 Advanced details -> User data before launching the instance.

The script will:

1. Install Docker and Docker Compose.
2. Clone `https://github.com/DevLoay/erp_anan.git`.
3. Create a secure `.env` on the server.
4. Start PostgreSQL.
5. Run `npx prisma migrate deploy`.
6. Create an Admin user.
7. Start the ERP on port `3040`.

## First Login

After the instance finishes booting, connect with SSH and read:

```bash
sudo cat /root/mohamed-shawki-erp-credentials.txt
```

It contains:

- Application URL
- Admin email
- Temporary admin password
- PostgreSQL credentials

Change the Admin password from the system before sharing real user accounts.

## Health Check

```bash
curl http://127.0.0.1:3040/api/health
```

Public URL format:

```text
http://EC2_PUBLIC_IP:3040
```

## Useful Commands

```bash
cd /opt/mohamed-shawki-erp
sudo docker compose ps
sudo docker compose logs --tail 200 web
sudo docker compose logs --tail 200 postgres
sudo docker compose restart web
```

## Update From GitHub

```bash
cd /opt/mohamed-shawki-erp
sudo git fetch --depth=1 origin main
sudo git reset --hard origin/main
sudo docker compose build --pull
sudo docker compose run --rm web npx prisma migrate deploy
sudo docker compose up -d
```

## Backup Database

```bash
cd /opt/mohamed-shawki-erp
sudo docker compose exec -T postgres pg_dump -U erp_user -d mohamed_shawki_erp -Fc > /root/mohamed-shawki-erp-backup.dump
```

## Notes

- Do not commit server `.env`.
- Do not run cleanup scripts on production without backup and explicit confirmation.
- If you later add a domain and HTTPS, set `APP_URL` to the final HTTPS URL and restart the app.
