"use client";

import { useState } from "react";
import { AlertPanel } from "./AlertPanel";
import { BarChartCard } from "./BarChartCard";
import { InsightCard } from "./InsightCard";
import { LineChartCard } from "./LineChartCard";
import { MetricCard } from "./MetricCard";
import { PerformanceGauge } from "./PerformanceGauge";
import { PieChartCard } from "./PieChartCard";
import { ProgressTargetCard } from "./ProgressTargetCard";
import { TopListCard } from "./TopListCard";
import type { PageAnalytics } from "@/lib/page-analytics";

type PageAnalyticsSectionProps = {
  analytics: PageAnalytics;
};

export function PageAnalyticsSection({ analytics }: PageAnalyticsSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAnalytics =
    analytics.metrics.length ||
    analytics.gauges.length ||
    analytics.progress.length ||
    analytics.charts.length ||
    analytics.topLists.length ||
    analytics.alerts.length ||
    analytics.insight;

  if (!hasAnalytics) {
    return (
      <InsightCard
        insight={{
          title: "لا توجد بيانات كافية",
          body: "لا توجد بيانات كافية لإظهار تحليل دقيق حالياً. عند إضافة أو استيراد بيانات تشغيلية ستظهر المؤشرات والتحليلات هنا.",
          tone: "slate",
        }}
      />
    );
  }

  const hasAdvanced = analytics.charts.length || analytics.topLists.length;

  return (
    <section className="space-y-5">
      {analytics.metrics.length ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          {analytics.metrics.map((metric) => (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              hint={metric.hint}
              tone={metric.tone}
            />
          ))}
        </div>
      ) : null}

      {analytics.gauges.length || analytics.progress.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {analytics.gauges.map((gauge) => (
            <PerformanceGauge
              key={gauge.title}
              title={gauge.title}
              value={gauge.value}
              target={gauge.target}
              label={gauge.label}
            />
          ))}
          {analytics.progress.map((progress) => (
            <ProgressTargetCard
              key={progress.title}
              title={progress.title}
              current={progress.current}
              target={progress.target}
              suffix={progress.suffix}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <InsightCard insight={analytics.insight} />
        <AlertPanel alerts={analytics.alerts} />
      </div>

      {hasAdvanced ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100"
            aria-expanded={showAdvanced}
          >
            <span>الرسوم والقوائم التحليلية</span>
            <span className="text-xs text-slate-500">{showAdvanced ? "إخفاء" : "عرض"}</span>
          </button>

          {showAdvanced ? (
            <div className="mt-3 space-y-4">
              {analytics.charts.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {analytics.charts.map((chart) => {
                    if (chart.type === "line") {
                      return <LineChartCard key={`${chart.type}:${chart.title}`} title={chart.title} data={chart.data} />;
                    }

                    if (chart.type === "pie") {
                      return <PieChartCard key={`${chart.type}:${chart.title}`} title={chart.title} data={chart.data} />;
                    }

                    return <BarChartCard key={`${chart.type}:${chart.title}`} title={chart.title} data={chart.data} />;
                  })}
                </div>
              ) : null}

              {analytics.topLists.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {analytics.topLists.map((list) => (
                    <TopListCard key={list.title} title={list.title} items={list.items} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
