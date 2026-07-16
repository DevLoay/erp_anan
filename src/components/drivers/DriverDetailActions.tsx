"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DriverActionButtons({ driverId }: { driverId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run(action: string) {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch(`/api/drivers/${driverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ الإجراء.");
      setMessage(payload.blocked ? `تم تعطيل المندوب بدل الحذف لوجود ${payload.linkedRecords} سجلات مرتبطة.` : "تم تنفيذ الإجراء.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={Boolean(busy)} onClick={() => run("reactivate")} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">تفعيل</button>
      <button disabled={Boolean(busy)} onClick={() => run("suspend")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">إيقاف</button>
      <button disabled={Boolean(busy)} onClick={() => run("archive")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">أرشفة</button>
      <button disabled={Boolean(busy)} onClick={() => run("safeDelete")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-800">حذف آمن</button>
      {message ? <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{message}</span> : null}
    </div>
  );
}

export function AccountActionButtons({ accountId, month, driverId }: { accountId: string; month: string; driverId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run(action: string, extra: Record<string, string> = {}) {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch(`/api/application-accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, month, ...extra }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ الإجراء.");
      setMessage(payload.blocked ? `تم تعطيل الحساب بدل الحذف لوجود ${payload.linkedRecords} سجلات مرتبطة.` : "تم تنفيذ الإجراء.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex min-w-[380px] flex-wrap items-center gap-2">
      <button disabled={Boolean(busy)} onClick={() => run("setPrimary", { driverId })} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-black text-blue-800">رئيسي</button>
      <button disabled={Boolean(busy)} onClick={() => run("assignActualWorker", { actualDriverId: driverId })} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-800">عامل فعلي</button>
      <button disabled={Boolean(busy)} onClick={() => run("unlink")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black">فك الربط</button>
      <button disabled={Boolean(busy)} onClick={() => run("suspend")} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">تعليق</button>
      <button disabled={Boolean(busy)} onClick={() => run("reactivate")} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-black text-emerald-800">تفعيل</button>
      <button disabled={Boolean(busy)} onClick={() => run("safeDelete")} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-black text-red-800">حذف آمن</button>
      {message ? <span className="w-full text-xs font-bold text-blue-700">{message}</span> : null}
    </div>
  );
}
