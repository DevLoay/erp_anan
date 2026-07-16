"use client";

import { useEffect } from "react";
import { LANGUAGE_STORAGE_KEY, translateText, type ErpLanguage } from "@/lib/i18n/dictionary";

const originalText = new WeakMap<Text, string>();
const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;

function currentLanguage(): ErpLanguage {
  if (typeof window === "undefined") return "ar";
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ar";
}

function translateTextNode(node: Text, language: ErpLanguage) {
  const raw = originalText.get(node) ?? node.nodeValue ?? "";
  if (!originalText.has(node)) originalText.set(node, raw);
  const next = translateText(raw, language);
  if (node.nodeValue !== next) node.nodeValue = next;
}

function translateElementAttrs(element: Element, language: ErpLanguage) {
  for (const attr of ATTRS) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const key = "data-i18n-original-" + attr;
    const original = element.getAttribute(key) ?? value;
    if (!element.hasAttribute(key)) element.setAttribute(key, original);
    element.setAttribute(attr, translateText(original, language));
  }
}

function walk(root: ParentNode, language: ErpLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      if (["script", "style", "textarea", "input"].includes(tag)) return NodeFilter.FILTER_REJECT;
      const text = node.nodeValue ?? "";
      if (!text.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) translateTextNode(node, language);

  if (root instanceof Element) translateElementAttrs(root, language);
  if ("querySelectorAll" in root) {
    root.querySelectorAll("[placeholder], [title], [aria-label], [alt]").forEach((el) => translateElementAttrs(el, language));
  }
}

function patchNativeMessages() {
  const target = window as typeof window & {
    __erpI18nPatched?: boolean;
    __erpOriginalAlert?: typeof window.alert;
    __erpOriginalConfirm?: typeof window.confirm;
  };
  if (target.__erpI18nPatched) return;
  target.__erpI18nPatched = true;
  target.__erpOriginalAlert = window.alert.bind(window);
  target.__erpOriginalConfirm = window.confirm.bind(window);

  window.alert = (message?: unknown) => {
    const language = currentLanguage();
    target.__erpOriginalAlert?.(translateText(String(message ?? ""), language));
  };

  window.confirm = (message?: string) => {
    const language = currentLanguage();
    return target.__erpOriginalConfirm?.(translateText(String(message ?? ""), language)) ?? false;
  };
}

// HYDRATION_SAFE_I18N_RUNTIME
export function I18nRuntime() {
  useEffect(() => {
    let pending = false;
    patchNativeMessages();

    const apply = () => {
      pending = false;
      const language = currentLanguage();
      document.documentElement.lang = language;
      document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
      document.body.dir = language === "ar" ? "rtl" : "ltr";
      document.body.dataset.language = language;
      walk(document.body, language);
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(apply);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [...ATTRS] });
    window.addEventListener("erp-language-changed", schedule as EventListener);
    window.addEventListener("storage", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("erp-language-changed", schedule as EventListener);
      window.removeEventListener("storage", schedule);
    };
  }, []);

  return null;
}
