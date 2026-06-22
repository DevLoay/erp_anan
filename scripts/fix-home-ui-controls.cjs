const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
  console.log(`✅ updated ${rel}`);
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function patchReportFilterBar() {
  const rel = 'src/components/reports/ReportFilterBar.tsx';
  if (!exists(rel)) {
    console.warn(`⚠️ missing ${rel}`);
    return;
  }
  let s = read(rel);
  let changed = false;

  if (!s.includes('name="dateFrom"')) {
    const dateBlock = `

        <label htmlFor="date-from-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          من تاريخ
          <input
            id="date-from-filter"
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label htmlFor="date-to-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          إلى تاريخ
          <input
            id="date-to-filter"
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>`;

    const marker = `        <label htmlFor="app-filter" className="grid gap-1 text-sm font-bold text-slate-700">`;
    if (s.includes(marker)) {
      s = s.replace(marker, `${dateBlock}\n\n${marker}`);
      changed = true;
    } else {
      console.warn('⚠️ Could not find insertion point for date filters in ReportFilterBar.');
    }
  }

  if (s.includes('xl:grid-cols-7')) {
    s = s.replaceAll('xl:grid-cols-7', 'xl:grid-cols-9');
    changed = true;
  }

  if (s.includes('مسح الفلاتر')) {
    s = s.replaceAll('مسح الفلاتر', 'عرض الكل');
    changed = true;
  }

  if (changed) write(rel, s);
  else console.log(`ℹ️ ${rel} already has date filters/reset label.`);
}

function patchResourceWorkspace() {
  const rel = 'src/components/ui/ResourceWorkspace.tsx';
  if (!exists(rel)) {
    console.warn(`⚠️ missing ${rel}`);
    return;
  }
  let s = read(rel);
  let changed = false;

  if (!s.includes('function printWorkspace(')) {
    const marker = `  const pageSize = compact ? 8 : 15;`;
    const fn = `  function printWorkspace() {
    if (typeof window !== "undefined") window.print();
  }

`;
    if (s.includes(marker)) {
      s = s.replace(marker, fn + marker);
      changed = true;
    } else {
      console.warn('⚠️ Could not find insertion point for printWorkspace in ResourceWorkspace.');
    }
  }

  if (!s.includes('onClick={printWorkspace}')) {
    const marker = `            <button type="button" onClick={() => downloadCsv(resource, rows, references)} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-100" disabled={!rows.length}>
              تصدير CSV
            </button>`;
    const printButton = `${marker}
            <button type="button" onClick={printWorkspace} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50" disabled={!rows.length}>
              طباعة
            </button>`;
    if (s.includes(marker)) {
      s = s.replace(marker, printButton);
      changed = true;
    } else if (!s.includes('طباعة')) {
      console.warn('⚠️ Could not find CSV button insertion point in ResourceWorkspace.');
    }
  }

  if (changed) write(rel, s);
  else console.log(`ℹ️ ${rel} already has print control.`);
}

function main() {
  console.log('\nHOME DASHBOARD UI CONTROLS FIX');
  console.log('Project root:', root);
  patchReportFilterBar();
  patchResourceWorkspace();
  console.log('\n✅ Done. Re-run: node scripts/check-home-ui-controls.cjs');
}

main();
