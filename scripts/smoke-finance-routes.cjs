/* eslint-disable no-console */
const routes = [
  '/',
  '/login',
  '/finance',
  '/payroll',
  '/payroll/settings',
  '/invoices',
  '/receivables',
  '/payments',
  '/expenses',
  '/revenues',
  '/advances',
  '/deductions',
  '/vehicle-finance',
  '/vehicle-cost',
  '/supplier-accounts',
  '/custody-cashbox',
  '/bank-accounts',
  '/vat',
  '/profit-loss',
  '/financial-reports',
];

const base = process.env.SMOKE_BASE_URL || 'http://localhost:3040';
const okStatus = new Set([200, 204, 301, 302, 307, 308, 401, 403]);

(async () => {
  console.log(`Finance smoke test: ${base}`);
  let bad = 0;
  for (const route of routes) {
    try {
      const res = await fetch(`${base}${route}`, { redirect: 'manual' });
      const ok = okStatus.has(res.status);
      console.log(`${ok ? '✅' : '❌'} ${String(res.status).padEnd(3)} ${route}`);
      if (!ok) bad++;
    } catch (error) {
      bad++;
      console.log(`❌ ERR ${route} — ${error.message}`);
    }
  }
  console.log(`\nSmoke result: ${bad ? 'FAILED' : 'OK'} | failed=${bad}`);
  process.exitCode = bad ? 1 : 0;
})();
