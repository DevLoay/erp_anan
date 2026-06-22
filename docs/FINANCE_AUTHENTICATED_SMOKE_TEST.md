# Finance authenticated smoke test

This check verifies finance pages after a real login, not only the unauthenticated redirect.

## PowerShell usage

```powershell
cd "C:\Users\hp\Desktop\أخر نسخه\MOHAMED SHAWKI ERP V85.12\apps\erp"

docker start erp-postgres-1
npm run dev
```

Open a second PowerShell:

```powershell
cd "C:\Users\hp\Desktop\أخر نسخه\MOHAMED SHAWKI ERP V85.12\apps\erp"

$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="PUT_REAL_PASSWORD_HERE"
node scripts/smoke-finance-auth-routes.cjs
```

## Expected result

Every protected route should return 200. Any 307 redirect to `/login` means the login cookie was not accepted.
Any 500 means that page still has a server/runtime issue.
