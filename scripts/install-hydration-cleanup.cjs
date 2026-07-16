/*
  Hydration cleanup installer for MOHAMED SHAWKI ERP.
  Goal: make the app shell deterministic during SSR/client hydration by rendering
  a tiny stable shell first, then mounting interactive Sidebar/Header/Assistant
  on the client. This prevents extension-injected fdprocessedid attributes and
  client-only UI state from causing hydration warnings.
*/
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = (...parts) => path.join(root, ...parts);
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log('✅ wrote', path.relative(root, p));
}
function backup(p) {
  if (!exists(p)) return;
  const rel = path.relative(root, p).replace(/[\\/]/g, '__');
  const backupDir = file('backups', 'hydration-cleanup');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, rel + '.bak'), read(p), 'utf8');
}

const appShellPath = file('src', 'components', 'layout', 'AppShell.tsx');
if (!exists(appShellPath)) {
  console.error('❌ Missing src/components/layout/AppShell.tsx');
  process.exit(1);
}
backup(appShellPath);
write(appShellPath, `"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SmartAssistant } from "@/components/layout/SmartAssistant";

function StableBootShell() {
  return (
    <main className="min-h-screen bg-slate-50" suppressHydrationWarning>
      <div className="flex min-h-screen items-center justify-center px-6" suppressHydrationWarning>
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm" suppressHydrationWarning>
          <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
          <p className="mt-2 text-sm font-bold text-slate-500">Loading workspace...</p>
        </div>
      </div>
    </main>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const authPage =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password") ||
    pathname === "/rider-app" ||
    pathname.startsWith("/rider-app");

  // Keep the server HTML and the very first client render identical.
  // This prevents hydration warnings caused by browser extensions such as
  // fdprocessedid, localStorage language state, Date/locale differences, and
  // Sidebar/Header state that only exists in the browser.
  if (!mounted) {
    return <StableBootShell />;
  }

  if (authPage) {
    return <main className="min-h-screen bg-slate-50" suppressHydrationWarning>{children}</main>;
  }

  return (
    <div className="flex min-h-screen" suppressHydrationWarning>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col" suppressHydrationWarning>
        <Header />
        <main className="flex-1 p-5 lg:p-7" suppressHydrationWarning>{children}</main>
      </div>
      <SmartAssistant />
    </div>
  );
}
`);

const runtimePath = file('src', 'components', 'i18n', 'I18nRuntime.tsx');
if (exists(runtimePath)) {
  backup(runtimePath);
  let content = read(runtimePath);
  // Make translation observer less aggressive: do not observe every characterData
  // mutation. This avoids translation loops and limits work to new nodes + target attrs.
  content = content.replace(
    /observer\.observe\(document\.body, \{ childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: \[\.\.\.ATTRS\] \}\);/,
    'observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [...ATTRS] });'
  );
  // Add a guard comment if not already present.
  if (!content.includes('HYDRATION_SAFE_I18N_RUNTIME')) {
    content = content.replace('export function I18nRuntime() {', '// HYDRATION_SAFE_I18N_RUNTIME\nexport function I18nRuntime() {');
  }
  write(runtimePath, content);
}

const sidebarPath = file('src', 'components', 'layout', 'Sidebar.tsx');
if (exists(sidebarPath)) {
  backup(sidebarPath);
  let s = read(sidebarPath);
  // Root aside warning suppression is harmless and helps when extensions touch nested nav before React attaches.
  s = s.replace(
    '<aside className="hidden sticky top-0 h-screen w-[20rem] shrink-0 overflow-y-auto border-l border-slate-200 bg-[#07111f] text-white lg:block">',
    '<aside className="hidden sticky top-0 h-screen w-[20rem] shrink-0 overflow-y-auto border-l border-slate-200 bg-[#07111f] text-white lg:block" suppressHydrationWarning>'
  );
  write(sidebarPath, s);
}

const headerPath = file('src', 'components', 'layout', 'Header.tsx');
if (exists(headerPath)) {
  backup(headerPath);
  let h = read(headerPath);
  h = h.replace(
    '<header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur" dir="rtl">',
    '<header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur" dir="rtl" suppressHydrationWarning>'
  );
  write(headerPath, h);
}

const layoutPath = file('src', 'app', 'layout.tsx');
if (exists(layoutPath)) {
  backup(layoutPath);
  let layout = read(layoutPath);
  layout = layout.replace(/<html([^>]*)>/, (m) => m.includes('suppressHydrationWarning') ? m : m.replace('>', ' suppressHydrationWarning>'));
  layout = layout.replace(/<body([^>]*)>/, (m) => m.includes('suppressHydrationWarning') ? m : m.replace('>', ' suppressHydrationWarning>'));
  write(layoutPath, layout);
}

console.log('\n✅ Hydration cleanup installed.');
console.log('Next: node scripts/check-hydration-cleanup.cjs');
