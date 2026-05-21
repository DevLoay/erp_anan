import { prisma } from "@/lib/prisma";
import { formatValue } from "@/lib/format";
import type { ResourceConfig } from "@/lib/resources";
import { EmptyState } from "./EmptyState";

type Delegate = {
  findMany(args?: unknown): Promise<Record<string, unknown>[]>;
};

function delegate(name: string): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[name];
}

async function findRows(source: Delegate) {
  try {
    return await source.findMany({ take: 50, orderBy: { updatedAt: "desc" } });
  } catch {
    try {
      return await source.findMany({ take: 50, orderBy: { createdAt: "desc" } });
    } catch {
      return source.findMany({ take: 50 });
    }
  }
}

export async function DataTable({ resource }: { resource: ResourceConfig }) {
  let rows: Record<string, unknown>[] = [];
  let error = "";

  try {
    rows = await findRows(delegate(resource.delegate));
  } catch (err) {
    error = err instanceof Error ? err.message : "Database connection error";
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
        قاعدة البيانات غير جاهزة أو لم يتم تشغيل PostgreSQL بعد. التفاصيل: {error}
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title="لا توجد بيانات محفوظة" body="سيظهر هذا القسم بعد إنشاء أو استيراد بيانات حقيقية." />;
  }

  return (
    <div className="table-scroll rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>
            {resource.columns.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-4 py-3">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={String(row.id)} className="hover:bg-slate-50">
              {resource.columns.map((column) => (
                <td key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                  {formatValue(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
