import type { InsightsReportData } from "@linear-insights/report-types";

function linearRegression(pts: number[]): number[] {
  const n = pts.length;
  if (n < 2) return pts.map((v) => v);
  const sx = pts.reduce((s, _, i) => s + i, 0);
  const sy = pts.reduce((s, v) => s + v, 0);
  const sxy = pts.reduce((s, v, i) => s + i * v, 0);
  const sx2 = pts.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sx2 - sx * sx;
  const m = denom ? (n * sxy - sx * sy) / denom : 0;
  const b = (sy - m * sx) / n;
  return pts.map((_, i) => parseFloat((m * i + b).toFixed(2)));
}

export interface ChartRow {
  month: string;
  opened: number;
  closed: number;
  cumClosed: number;
  openAtEnd: number;
  delta: number;
  trendKey: number;
}

export interface ChartStats {
  totalClosed: number;
  openCount: number;
  overdueCount: number;
  velocityPerMonth: number;
  avgLifetimeDays: number | null;
  busiestMonth: string;
  busiestClosed: number;
}

export function buildChartDataFromReport(report: InsightsReportData): {
  moData: ChartRow[];
  woData: ChartRow[] | null;
  stats: ChartStats;
} {
  const buckets = report.lifecycle.buckets;
  const unified = report.unified;
  const openRows = unified.filter((r) => r.State !== "Completed");

  const parseNum = (s: string): number => (s === "—" || s === "" ? 0 : parseInt(String(s).replace(/\D/g, ""), 10) || 0);

  const moData: ChartRow[] = buckets.map((b) => {
    const opened = parseNum(b.Created);
    const closed = parseNum(b.Closed);
    const cumCreated = parseNum(b["Cumul. created"]);
    const cumClosed = parseNum(b["Cumul. closed"]);
    const openAtEnd = Math.max(0, cumCreated - cumClosed);
    const delta = opened - closed;
    return {
      month: b.Month,
      opened,
      closed,
      cumClosed,
      openAtEnd,
      delta,
      trendKey: 0,
    };
  });

  const closedValues = moData.map((d) => d.closed);
  const trendKey = linearRegression(closedValues);
  moData.forEach((row, i) => {
    row.trendKey = trendKey[i] ?? row.closed;
  });

  let woData: ChartRow[] | null = null;
  if (report.velocityWeekly?.buckets?.length) {
    const wb = report.velocityWeekly.buckets;
    const labels = report.velocityWeekly.weekLabels ?? wb.map((b) => b.week);
    let cumCreated = 0;
    let cumClosed = 0;
    woData = wb.map((b, i) => {
      cumCreated += b.created;
      cumClosed += b.closed;
      const openAtEnd = Math.max(0, cumCreated - cumClosed);
      const delta = b.created - b.closed;
      return {
        month: labels[i] ?? b.week,
        opened: b.created,
        closed: b.closed,
        cumClosed,
        openAtEnd,
        delta,
        trendKey: 0,
      };
    });
    const woClosedValues = woData.map((d) => d.closed);
    const woTrend = linearRegression(woClosedValues);
    woData.forEach((row, i) => {
      row.trendKey = woTrend[i] ?? row.closed;
    });
  }

  const totalClosed = closedValues.reduce((a, b) => a + b, 0);
  const velocityPerMonth =
    report.velocity.buckets.length > 0
      ? report.velocity.buckets.reduce((a, b) => a + b.closed, 0) / report.velocity.buckets.length
      : 0;
  const overdueCount = openRows.filter((r) => {
    const d = parseNum(r["Days left"]);
    return d < 0;
  }).length;
  const busiest = moData.reduce(
    (a, b) => (b.closed > a.closed ? { month: b.month, closed: b.closed } : a),
    { month: "—", closed: 0 }
  );

  return {
    moData,
    woData,
    stats: {
      totalClosed,
      openCount: openRows.length,
      overdueCount,
      velocityPerMonth: parseFloat(velocityPerMonth.toFixed(1)),
      avgLifetimeDays: report.lifecycle.averageLifetimeDays,
      busiestMonth: busiest.month,
      busiestClosed: busiest.closed,
    },
  };
}
