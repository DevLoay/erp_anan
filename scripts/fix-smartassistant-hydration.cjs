const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'layout', 'SmartAssistant.tsx');

if (!fs.existsSync(file)) {
  console.error('❌ SmartAssistant.tsx not found:', file);
  process.exit(1);
}

let text = fs.readFileSync(file, 'utf8');
let changed = false;

// Add suppressHydrationWarning to the Smart Assistant floating button to silence browser-extension fdprocessedid mismatches.
if (text.includes('aria-label="فتح المساعد الذكي"') && !text.includes('aria-label="فتح المساعد الذكي"\n            suppressHydrationWarning')) {
  text = text.replace(
    'aria-label="فتح المساعد الذكي"',
    'aria-label="فتح المساعد الذكي"\n            suppressHydrationWarning'
  );
  changed = true;
}

// More tolerant fallback if formatting changed.
if (!changed && text.includes('aria-label="فتح المساعد الذكي"') && !/suppressHydrationWarning[\s\S]{0,120}>[\s\S]{0,30}AI/.test(text)) {
  text = text.replace(/(<button\b[\s\S]*?aria-label="فتح المساعد الذكي"[\s\S]*?)(>)/, (m, before, close) => {
    if (before.includes('suppressHydrationWarning')) return m;
    changed = true;
    return `${before}\n            suppressHydrationWarning${close}`;
  });
}

if (changed) {
  fs.writeFileSync(file, text, 'utf8');
  console.log('✅ SmartAssistant hydration warning suppressed.');
} else {
  console.log('ℹ️ No change needed, or suppressHydrationWarning already exists.');
}
