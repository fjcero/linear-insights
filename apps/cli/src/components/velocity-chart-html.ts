import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Bucket {
  month: string;
  created: number;
  closed: number;
}

/**
 * Write a single HTML file with a bar chart (Chart.js from CDN).
 * Reusable for velocity / created-vs-closed reports.
 */
export async function writeVelocityChartHtml(
  buckets: Bucket[],
  monthLabels: string[],
  outputPath: string
): Promise<void> {
  const labels = monthLabels.map((l) => JSON.stringify(l)).join(",");
  const createdData = buckets.map((b) => b.created).join(",");
  const closedData = buckets.map((b) => b.closed).join(",");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Linear Insights – Projects created / closed by month</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #1a1a1a; color: #e0e0e0; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    h2 { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: #94a3b8; }
    .chart { max-width: 720px; height: 280px; }
  </style>
</head>
<body>
  <h1>Projects created vs closed by month</h1>
  <h2>Trend (line)</h2>
  <div class="chart"><canvas id="lineChart"></canvas></div>
  <h2>By month (bars)</h2>
  <div class="chart"><canvas id="barChart"></canvas></div>
  <script>
    const labels = [${labels}];
    const createdData = [${createdData}];
    const closedData = [${closedData}];
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "rgba(255,255,255,0.08)" } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { position: "top" } }
    };
    new Chart(document.getElementById("lineChart").getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "Created", data: createdData, borderColor: "rgb(34, 211, 238)", backgroundColor: "rgba(34, 211, 238, 0.1)", fill: true, tension: 0.2, pointRadius: 3 },
          { label: "Closed",  data: closedData,  borderColor: "rgb(34, 197, 94)",  backgroundColor: "rgba(34, 197, 94, 0.1)",  fill: true, tension: 0.2, pointRadius: 3 }
        ]
      },
      options: { ...chartOptions }
    });
    new Chart(document.getElementById("barChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Created", data: createdData, backgroundColor: "rgba(59, 130, 246, 0.8)", borderColor: "rgb(59, 130, 246)", borderWidth: 1 },
          { label: "Closed",  data: closedData,  backgroundColor: "rgba(34, 197, 94, 0.8)",  borderColor: "rgb(34, 197, 94)",  borderWidth: 1 }
        ]
      },
      options: { ...chartOptions }
    });
  </script>
</body>
</html>
`;

  await writeFile(outputPath, html, "utf-8");
}

export const DEFAULT_CHART_FILENAME = "linear-insights-velocity.html";

export function getChartOutputPath(): string {
  const env = process.env.LINEAR_INSIGHTS_CHART_OUTPUT;
  if (env?.trim()) return env.trim();
  return join(process.cwd(), DEFAULT_CHART_FILENAME);
}
