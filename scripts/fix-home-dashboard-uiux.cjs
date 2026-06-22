const fs = require('fs');
const path = require('path');

const root = process.cwd();
const globalsPath = path.join(root, 'src', 'app', 'globals.css');
const marker = '/* HOME_DASHBOARD_CLOSEOUT_PRINT_AND_LAYOUT */';

function appendCss() {
  if (!fs.existsSync(globalsPath)) {
    console.warn('⚠️ globals.css not found, skipping CSS polish.');
    return;
  }
  const before = fs.readFileSync(globalsPath, 'utf8');
  if (before.includes(marker)) {
    console.log('✅ home/dashboard CSS polish already installed');
    return;
  }

  const css = `\n\n${marker}\n@media print {\n  aside, nav, header button, [data-print-hide=\"true\"], .no-print {\n    display: none !important;\n  }\n\n  body {\n    background: #fff !important;\n  }\n\n  main, section, article {\n    box-shadow: none !important;\n    break-inside: avoid;\n  }\n\n  table {\n    page-break-inside: auto;\n  }\n\n  tr {\n    page-break-inside: avoid;\n    page-break-after: auto;\n  }\n}\n\n@media (max-width: 900px) {\n  [data-home-dashboard-grid=\"true\"],\n  [data-home-reports-grid=\"true\"] {\n    grid-template-columns: 1fr !important;\n  }\n}\n\n.home-dashboard-closeout-scroll {\n  overflow-x: auto;\n  scrollbar-width: thin;\n}\n\n.home-dashboard-closeout-scroll table {\n  min-width: 960px;\n}\n`;

  fs.writeFileSync(globalsPath, before + css, 'utf8');
  console.log('✅ appended home/dashboard print and responsive CSS');
}

appendCss();
console.log('Home/dashboard UI/UX polish completed.');
console.log('Run: node scripts/check-home-dashboard-closeout.cjs');
