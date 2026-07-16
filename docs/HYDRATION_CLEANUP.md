# Hydration cleanup phase

This patch makes the ERP app shell hydration-safe by rendering a stable loading shell during SSR and the first client render, then mounting interactive UI after `useEffect`.

Why:
- Browser extensions inject attributes such as `fdprocessedid` before React hydrates.
- Sidebar/Header state and localStorage language selection can differ between server render and client render.
- Next.js dev mode shows hydration warnings when the first client render does not exactly match server HTML.

What changed:
- `src/components/layout/AppShell.tsx` now uses a mounted gate and `StableBootShell`.
- `I18nRuntime` observer no longer watches every character text mutation.
- Root Header/Sidebar/layout nodes get `suppressHydrationWarning` as an extra safety layer.

Tradeoff:
- App pages render after client mount instead of fully SSR-rendering the internal workspace. This is acceptable for an authenticated ERP and removes hydration noise.
