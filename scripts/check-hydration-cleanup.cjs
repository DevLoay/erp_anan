const fs = require('fs');
const path = require('path');
const root = process.cwd();
function p(...parts) { return path.join(root, ...parts); }
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function ok(label, pass, detail = '') {
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  return pass ? 0 : 1;
}
let failed = 0;
console.log('Hydration cleanup check');
console.log('Project root:', root);
console.log('');
const appShell = read(p('src','components','layout','AppShell.tsx'));
failed += ok('AppShell mounted gate', appShell.includes('const [mounted, setMounted]') && appShell.includes('if (!mounted)'));
failed += ok('StableBootShell exists', appShell.includes('function StableBootShell'));
failed += ok('AppShell suppressHydrationWarning', appShell.includes('suppressHydrationWarning'));
failed += ok('App shell keeps auth pages', appShell.includes('authPage') && appShell.includes('/login'));

const runtime = read(p('src','components','i18n','I18nRuntime.tsx'));
if (runtime) {
  failed += ok('I18n runtime present', runtime.includes('I18nRuntime'));
  failed += ok('I18n runtime is effect-based', runtime.includes('useEffect'));
  failed += ok('I18n observer not characterData-heavy', !runtime.includes('characterData: true'));
}
const sidebar = read(p('src','components','layout','Sidebar.tsx'));
if (sidebar) failed += ok('Sidebar suppressHydrationWarning', sidebar.includes('suppressHydrationWarning'));
const header = read(p('src','components','layout','Header.tsx'));
if (header) failed += ok('Header suppressHydrationWarning', header.includes('suppressHydrationWarning'));

console.log('');
console.log(`Hydration cleanup result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
process.exit(failed ? 1 : 0);
