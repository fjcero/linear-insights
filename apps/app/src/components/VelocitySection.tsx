import type { InsightsReportData } from "@linear-insights/report-types";

type Velocity = InsightsReportData["velocity"];

function trendLabel(trend: string): string {
  if (trend === "accelerating") return "Accelerating";
  if (trend === "slowing") return "Slowing";
  if (trend === "steady") return "Steady";
  return "—";
}

function trendColor(trend: string): string {
  if (trend === "accelerating") return "#4ade80";
  if (trend === "slowing") return "#ef4444";
  if (trend === "steady") return "#3b82f6";
  return "#64748b";
}

export function VelocitySection({ velocity }: { velocity: Velocity }) {
  const { buckets, trend, trendPreviousTotal, trendRecentTotal } = velocity;

  if (buckets.length === 0) {
    return <p style={{ color: "#64748b" }}>No project data by month.</p>;
  }

  const numeric =
    trendPreviousTotal > 0 || trendRecentTotal > 0
      ? ` (closed: last 2 months ${trendRecentTotal} vs previous 2 months ${trendPreviousTotal})`
      : "";

  return (
    <p style={{ margin: 0 }}>
      <strong>Recent trend: </strong>
      <span style={{ color: trendColor(trend) }}>{trendLabel(trend)}{numeric}</span>
    </p>
  );
}
