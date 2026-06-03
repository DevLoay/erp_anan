"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AttendancePageData } from "@/lib/attendance/getAttendancePageData";

type CaptureAction = "check-in" | "check-out";
type PersonType = "driver" | "supervisor" | "user";

type CaptureState = {
  action: CaptureAction;
  personType: PersonType;
  personId: string;
};

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "green" | "amber" | "blue" | "red" }) {
  const colors = {
    slate: "text-slate-950",
    green: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    red: "text-red-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className={`mt-1 block text-2xl font-black ${colors[tone]}`}>{value}</strong>
    </div>
  );
}

function HeaderButton({ children, onClick, tone = "white" }: { children: string; onClick: () => void; tone?: "white" | "green" | "blue" | "amber" | "red" }) {
  const classes = {
    white: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    amber: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
    red: "border-red-600 bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button type="button" onClick={onClick} className={`h-10 rounded-xl border px-4 text-sm font-black shadow-sm ${classes[tone]}`}>
      {children}
    </button>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "green" | "amber" | "red" }) {
  const classes = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes[tone]}`}>{label}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm font-bold text-slate-500">{body}</p>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[100] max-w-xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-2xl">
      {message}
      <button type="button" onClick={onClose} className="mr-3 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">
        إغلاق
      </button>
    </div>
  );
}

function exportCsv(data: AttendancePageData) {
  const headers = ["الشخص", "النوع", "الكود", "المدينة", "المشروع", "المشرف", "التاريخ", "حضور", "انصراف", "الساعات", "الحالة", "صورة حضور", "صورة انصراف"];
  const lines = data.rows.map((row) =>
    [
      row.personName,
      row.personType,
      row.personCode,
      row.city,
      row.project,
      row.supervisor,
      row.workDate,
      row.checkIn,
      row.checkOut,
      row.workingHours,
      row.statusLabel,
      row.checkInPhoto ? "yes" : "no",
      row.checkOutPhoto ? "yes" : "no",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([`\uFEFF${[headers.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${data.filters.fromDate}-${data.filters.toDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function CaptureModal({
  data,
  state,
  onClose,
  onSaved,
}: {
  data: AttendancePageData;
  state: CaptureState;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [personType, setPersonType] = useState<PersonType>(state.personType);
  const [personId, setPersonId] = useState(state.personId);
  const [photo, setPhoto] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [saving, setSaving] = useState(false);

  const people = useMemo(() => data.people.filter((person) => person.type === personType), [data.people, personType]);
  const actionLabel = state.action === "check-in" ? "تصوير الحضور" : "تصوير الانصراف";
  const saveLabel = state.action === "check-in" ? "اعتماد الحضور" : "اعتماد الانصراف";

  useEffect(() => {
    let mounted = true;
    async function openCamera() {
      setCameraError("");
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("المتصفح الحالي لا يدعم فتح الكاميرا. يمكنك رفع صورة بدلًا من ذلك.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } }, audio: false });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => null);
        }
      } catch {
        setCameraError("تعذر فتح الكاميرا. تأكد من صلاحية الكاميرا أو استخدم رفع صورة من الجهاز.");
      }
    }
    void openCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      setCameraError("الكاميرا لم تجهز بعد. انتظر لحظة أو ارفع صورة من الجهاز.");
      return;
    }
    const width = Math.min(video.videoWidth, 960);
    const height = Math.round((width / video.videoWidth) * video.videoHeight);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.72));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCameraError("الملف المختار ليس صورة.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function saveCapture() {
    if (!personId) {
      setCameraError("اختر الشخص قبل الاعتماد.");
      return;
    }
    if (!photo) {
      setCameraError("التقط صورة أو ارفع صورة قبل الاعتماد.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/attendance/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personType,
        personId,
        action: state.action,
        workDate: data.filters.workDate,
        capturedAt: new Date().toISOString(),
        photoDataUrl: photo,
      }),
    });
    setSaving(false);
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setCameraError(payload.error || "تعذر حفظ حركة الحضور.");
      return;
    }
    onSaved(state.action === "check-in" ? "تم تسجيل الحضور بالصورة." : "تم تسجيل الانصراف بالصورة.");
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" dir="rtl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-3xl font-black text-slate-950">{actionLabel}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">اختر الشخص، افتح الكاميرا، ثم التقط الصورة واحفظ الحركة.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black">
            إغلاق
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3">
            <label htmlFor="attendance-modal-type" className="grid gap-1 text-sm font-black text-slate-800">
              النوع
              <select
                id="attendance-modal-type"
                value={personType}
                onChange={(event) => {
                  const nextType = event.target.value as PersonType;
                  setPersonType(nextType);
                  setPersonId(data.people.find((person) => person.type === nextType)?.id || "");
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
              >
                <option value="driver">مندوب</option>
                <option value="supervisor">مشرف</option>
                <option value="user">مستخدم</option>
              </select>
            </label>

            <label htmlFor="attendance-modal-person" className="grid gap-1 text-sm font-black text-slate-800">
              الشخص
              <select id="attendance-modal-person" value={personId} onChange={(event) => setPersonId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="">اختر الشخص</option>
                {people.map((person) => (
                  <option key={`${person.type}-${person.id}`} value={person.id}>
                    {person.label} - {person.subLabel}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-7 text-blue-900">
              يتم حفظ صورة مستقلة للحضور وصورة مستقلة للانصراف داخل سجل نفس اليوم. لو الكاميرا غير متاحة في المتصفح الحالي استخدم زر رفع صورة.
            </div>

            {cameraError ? <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-black text-red-700">{cameraError}</div> : null}
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
              {photo ? <img src={photo} alt="الصورة الملتقطة" className="h-[360px] w-full object-contain" /> : <video ref={videoRef} muted playsInline className="h-[360px] w-full object-contain" />}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={capturePhoto} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm">
                التقاط الصورة
              </button>
              <label htmlFor="attendance-upload-photo" className="grid cursor-pointer place-items-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm">
                رفع صورة
                <input id="attendance-upload-photo" type="file" accept="image/*" capture="user" onChange={onFileChange} className="hidden" />
              </label>
              {photo ? (
                <button type="button" onClick={() => setPhoto("")} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm">
                  إعادة التصوير
                </button>
              ) : null}
              <button type="button" onClick={saveCapture} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">
                {saving ? "جار الحفظ..." : saveLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AttendanceCameraClient({ data }: { data: AttendancePageData }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [preview, setPreview] = useState<{ title: string; src: string } | null>(null);
  const [selectedPerson, setSelectedPerson] = useState("");

  const defaultPerson = data.people[0];

  function openCapture(action: CaptureAction, personType?: PersonType, personId?: string) {
    const targetId = personId || selectedPerson;
    const found = targetId ? data.people.find((person) => person.id === targetId && (!personType || person.type === personType)) : null;
    const fallback = found || defaultPerson;
    if (!fallback) {
      setToast("لا يوجد أشخاص متاحون للتسجيل حسب الصلاحيات الحالية.");
      return;
    }
    setCapture({ action, personType: (personType || fallback.type) as PersonType, personId: fallback.id });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      const text = String(value || "").trim();
      if (text) params.set(key, text);
    }
    router.push(`/attendance?${params.toString()}`);
  }

  if (data.databaseStatus === "offline") {
    return (
      <main className="w-full max-w-none bg-slate-50" dir="rtl">
        <EmptyState title="قاعدة البيانات غير متصلة" body={data.databaseMessage || "يرجى تشغيل PostgreSQL ثم تحديث الصفحة."} />
      </main>
    );
  }

  return (
    <main className="w-full max-w-none space-y-4 bg-slate-50" dir="rtl" suppressHydrationWarning>
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {capture ? <CaptureModal data={data} state={capture} onClose={() => setCapture(null)} onSaved={setToast} /> : null}
      {preview ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-950">{preview.title}</h2>
              <button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black">
                إغلاق
              </button>
            </div>
            <img src={preview.src} alt={preview.title} className="max-h-[70vh] w-full rounded-2xl border border-slate-200 object-contain" />
          </div>
        </div>
      ) : null}

      <section className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <nav className="mb-1 flex items-center gap-2 text-xs font-black text-slate-500">
              <span>الرئيسية</span>
              <span>/</span>
              <span>الحضور والانصراف</span>
            </nav>
            <h1 className="text-3xl font-black text-slate-950">الحضور والانصراف</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">تسجيل حضور وانصراف المناديب والمشرفين بالصورة وربط الساعات بالمتابعة التشغيلية.</p>
          </div>
          <button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xl font-black text-slate-800">
            رجوع
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <HeaderButton onClick={() => window.print()}>طباعة / PDF</HeaderButton>
          <HeaderButton tone="amber" onClick={() => exportCsv(data)}>تصدير إكسل</HeaderButton>
          <HeaderButton tone="green" onClick={() => openCapture("check-in")}>+ تسجيل حضور</HeaderButton>
          <HeaderButton tone="blue" onClick={() => openCapture("check-in")}>تسجيل حضور سريع</HeaderButton>
          <HeaderButton tone="amber" onClick={() => openCapture("check-out")}>تسجيل انصراف سريع</HeaderButton>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <SummaryCard title="إجمالي السجلات" value={number(data.summary.total)} tone="blue" />
        <SummaryCard title="حضور" value={number(data.summary.present)} tone="green" />
        <SummaryCard title="مكتمل" value={number(data.summary.completed)} tone="green" />
        <SummaryCard title="بدون انصراف" value={number(data.summary.missingCheckOut)} tone={data.summary.missingCheckOut ? "amber" : "slate"} />
        <SummaryCard title="سجلات مشرفين" value={number(data.summary.supervisors)} />
        <SummaryCard title="سجلات مناديب" value={number(data.summary.drivers)} />
        <SummaryCard title="صور حضور" value={number(data.summary.withCheckInPhoto)} tone="blue" />
        <SummaryCard title="صور انصراف" value={number(data.summary.withCheckOutPhoto)} tone="blue" />
      </section>

      <form onSubmit={submitSearch} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label htmlFor="attendance-from" className="grid gap-1 text-xs font-black text-slate-800">
            من تاريخ
            <input id="attendance-from" name="fromDate" type="date" defaultValue={data.filters.fromDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label htmlFor="attendance-to" className="grid gap-1 text-xs font-black text-slate-800">
            إلى تاريخ
            <input id="attendance-to" name="toDate" type="date" defaultValue={data.filters.toDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label htmlFor="attendance-work-date" className="grid gap-1 text-xs font-black text-slate-800">
            تاريخ التسجيل
            <input id="attendance-work-date" name="workDate" type="date" defaultValue={data.filters.workDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label htmlFor="attendance-type" className="grid gap-1 text-xs font-black text-slate-800">
            النوع
            <select id="attendance-type" name="personType" defaultValue={data.filters.personType} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل الأنواع</option>
              <option value="driver">المناديب</option>
              <option value="supervisor">المشرفين</option>
              <option value="user">المستخدمين</option>
            </select>
          </label>
          <label htmlFor="attendance-person" className="grid gap-1 text-xs font-black text-slate-800">
            تسجيل سريع للشخص
            <select id="attendance-person" value={selectedPerson} onChange={(event) => setSelectedPerson(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">اختيار تلقائي</option>
              {data.people.map((person) => (
                <option key={`${person.type}-${person.id}`} value={person.id}>
                  {person.label} - {person.subLabel}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="attendance-q" className="grid gap-1 text-xs font-black text-slate-800">
            بحث
            <input id="attendance-q" name="q" defaultValue={data.filters.q} placeholder="بحث باسم الشخص أو الكود" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="h-11 rounded-xl bg-slate-900 px-8 text-sm font-black text-white shadow-sm">
            تطبيق
          </button>
          <button type="button" onClick={() => router.push("/attendance")} className="h-11 rounded-xl border border-slate-200 bg-white px-8 text-sm font-black text-slate-900 shadow-sm">
            عرض الكل
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse text-right text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-700">
              <tr>
                {["الشخص", "النوع", "الكود", "المدينة", "المشروع", "المشرف", "التاريخ", "حضور", "انصراف", "الساعات", "الحالة", "صورة الحضور", "صورة الانصراف", "إجراءات"].map((head) => (
                  <th key={head} className="border-b border-slate-200 px-3 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-3">
                    <strong className="block text-slate-950">{row.personName}</strong>
                    <span className="text-xs font-bold text-slate-500">{row.personCode}</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.personType === "driver" ? "مندوب" : row.personType === "supervisor" ? "مشرف" : "مستخدم"}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.personCode}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.city}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.project}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.supervisor}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.workDate}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-black">{row.checkIn}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-black">{row.checkOut}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-black">{row.workingHours}</td>
                  <td className="border-b border-slate-100 px-3 py-3"><StatusBadge label={row.statusLabel} tone={row.statusTone} /></td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {row.checkInPhoto ? (
                      <button type="button" onClick={() => setPreview({ title: `صورة حضور ${row.personName}`, src: row.checkInPhoto })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-900">
                        عرض الصورة
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-500">لا توجد صورة</span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {row.checkOutPhoto ? (
                      <button type="button" onClick={() => setPreview({ title: `صورة انصراف ${row.personName}`, src: row.checkOutPhoto })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-900">
                        عرض الصورة
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-500">لا توجد صورة</span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => openCapture("check-in", row.personType, row.personId)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
                        حضور
                      </button>
                      <button type="button" onClick={() => openCapture("check-out", row.personType, row.personId)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
                        انصراف
                      </button>
                      {row.personType === "driver" ? (
                        <button type="button" onClick={() => router.push(`/rider-reports?driverId=${encodeURIComponent(row.personId)}&dateFrom=${encodeURIComponent(row.workDate)}&dateTo=${encodeURIComponent(row.workDate)}`)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">
                          تقرير المندوب
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.rows.length ? <EmptyState title="لا توجد سجلات حضور للفلاتر الحالية" body="سجل حضور أو انصراف بالكاميرا، أو غيّر نطاق التاريخ والبحث." /> : null}
      </section>
    </main>
  );
}
