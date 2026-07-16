"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { navSections } from "@/lib/navigation";
import type { ModuleItem, ModuleSection } from "@/lib/modules";

function allowedResourcesFromCookie() {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("erp-nav-resources="))
    ?.slice("erp-nav-resources=".length);
  if (!raw) return null;
  return new Set(decodeURIComponent(raw).split(",").map((item) => item.trim()).filter(Boolean));
}

function filterItem(item: ModuleItem, allowed: Set<string> | null): ModuleItem | null {
  if (!allowed || allowed.has("*")) return item;
  const children = item.children?.map((child) => filterItem(child, allowed)).filter(Boolean) as ModuleItem[] | undefined;
  const itemAllowed = !item.resource || allowed.has(item.resource);
  if (!itemAllowed && !children?.length) return null;
  return children ? { ...item, children } : item;
}

function filterSections(sections: ModuleSection[], allowed: Set<string> | null) {
  return sections
    .map((section) => ({ ...section, items: section.items.map((item) => filterItem(item, allowed)).filter(Boolean) as ModuleItem[] }))
    .filter((section) => section.items.length);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemHasActivePath(item: ModuleItem, pathname: string): boolean {
  return isActivePath(pathname, item.href) || Boolean(item.children?.some((child) => itemHasActivePath(child, pathname)));
}

function activeSectionKeys(sections: ModuleSection[], pathname: string) {
  return sections.filter((section) => section.items.some((item) => itemHasActivePath(item, pathname))).map((section) => section.title);
}

function activeGroupKeys(items: ModuleItem[], pathname: string): string[] {
  return items.flatMap((item) => {
    const children = item.children ?? [];
    const childActive = children.some((child) => itemHasActivePath(child, pathname));
    return [...(childActive ? [item.href] : []), ...activeGroupKeys(children, pathname)];
  });
}

export function Sidebar() {
  const pathname = usePathname();
  const [allowedResources] = useState<Set<string> | null>(() => allowedResourcesFromCookie());
  const visibleSections = useMemo(() => filterSections(navSections, allowedResources), [allowedResources]);
  const initialSections = useMemo(() => {
    const active = activeSectionKeys(visibleSections, pathname);
    return new Set(active.length ? active : visibleSections.slice(0, 2).map((section) => section.title));
  }, [pathname, visibleSections]);
  const initialGroups = useMemo(() => new Set(visibleSections.flatMap((section) => activeGroupKeys(section.items, pathname))), [pathname, visibleSections]);

  const [openSections, setOpenSections] = useState<Set<string>>(initialSections);
  const [openGroups, setOpenGroups] = useState<Set<string>>(initialGroups);

  useEffect(() => {
    const sectionsToOpen = activeSectionKeys(visibleSections, pathname);
    const groupsToOpen = visibleSections.flatMap((section) => activeGroupKeys(section.items, pathname));

    if (sectionsToOpen.length) {
      setOpenSections((current) => new Set([...current, ...sectionsToOpen]));
    }
    if (groupsToOpen.length) {
      setOpenGroups((current) => new Set([...current, ...groupsToOpen]));
    }
  }, [pathname, visibleSections]);

  function toggleSection(title: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function toggleGroup(href: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  return (
    <aside className="hidden sticky top-0 h-screen w-[20rem] shrink-0 overflow-y-auto border-l border-slate-200 bg-[#07111f] text-white lg:block" suppressHydrationWarning>
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#07111f] px-5 py-5">
        <p className="text-xs font-semibold text-sky-200">نظام إنتاجي منظم</p>
        <h1 className="mt-1 text-lg font-black tracking-normal">MOHAMED SHAWKI ERP</h1>
      </div>

      <nav className="space-y-3 px-3 py-4" aria-label="القائمة الرئيسية">
        {visibleSections.map((section) => {
          const sectionOpen = openSections.has(section.title);
          const sectionActive = section.items.some((item) => itemHasActivePath(item, pathname));

          return (
            <section key={section.title} className="rounded-2xl border border-white/5 bg-white/[0.03]">
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                aria-expanded={sectionOpen}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-right text-sm font-black transition ${
                  sectionActive ? "bg-white/10 text-white" : "text-sky-100 hover:bg-white/10"
                }`}
              >
                <span className="truncate">{section.title}</span>
                <span className={`text-xs transition-transform duration-200 ${sectionOpen ? "rotate-180" : ""}`}>⌄</span>
              </button>

              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${sectionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="grid gap-1 px-2 pb-3">
                    {section.items.map((item) => (
                      <SidebarItem key={item.href} item={item} pathname={pathname} openGroups={openGroups} onToggleGroup={toggleGroup} level={0} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  openGroups,
  onToggleGroup,
  level,
}: {
  item: ModuleItem;
  pathname: string;
  openGroups: Set<string>;
  onToggleGroup: (href: string) => void;
  level: number;
}) {
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const active = isActivePath(pathname, item.href);
  const activeInside = itemHasActivePath(item, pathname);
  const groupOpen = openGroups.has(item.href);
  const padding = level === 0 ? "pr-3" : level === 1 ? "pr-6" : "pr-9";

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 py-2 ${padding} text-sm font-bold transition ${
          active ? "bg-white text-slate-950 shadow-sm" : "text-slate-100 hover:bg-white/10"
        }`}
      >
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={() => onToggleGroup(item.href)}
        aria-expanded={groupOpen}
        className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 ${padding} text-right text-sm font-bold transition ${
          activeInside ? "bg-white/10 text-white" : "text-slate-100 hover:bg-white/10"
        }`}
      >
        <span className="truncate">{item.label}</span>
        <span className={`text-xs transition-transform duration-200 ${groupOpen ? "rotate-180" : ""}`}>⌄</span>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${groupOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="mr-3 grid gap-1 border-r border-white/10 pr-2">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-lg px-3 py-2 text-xs font-black transition ${
                active ? "bg-white text-slate-950 shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              فتح {item.label}
            </Link>
            {children.map((child) => (
              <SidebarItem key={child.href} item={child} pathname={pathname} openGroups={openGroups} onToggleGroup={onToggleGroup} level={level + 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
