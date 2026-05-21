export type AnalyticsTone = "emerald" | "amber" | "red" | "blue" | "slate" | "orange" | "rose";

export type ChartDatum = {
  name: string;
  value?: number;
  secondary?: number;
  [key: string]: string | number | undefined;
};

export type Insight = {
  title: string;
  body: string;
  tone?: AnalyticsTone;
};

export type SmartAlert = {
  title: string;
  body: string;
  severity: "critical" | "warning" | "info" | "good";
  href?: string;
};

export type TopListItem = {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  tone?: AnalyticsTone;
};
