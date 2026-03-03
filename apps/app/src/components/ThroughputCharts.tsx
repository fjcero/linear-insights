import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { ChartRow, ChartStats } from "../lib/chartData";
import type { DateRange } from "../App";

const CHART_VIEWS = ["Opened vs Closed", "Cumulative Backlog", "Backlog Delta", "Velocity Trend"];
function subtitle(gran: "MoM" | "WoW", viewIndex: number): string {
  const base = [
    "Projects opened vs closed",
    "Open backlog vs cumulative closed",
    "Net backlog change",
    "Throughput + regression trendline",
  ][viewIndex];
  return `${base} · ${gran}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div
      style={{
        background: "#080d1a",
        border: "1px solid #1a2540",
        borderRadius: 8,
        padding: "12px 16px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "0.6875rem",
        maxWidth: 310,
      }}
    >
      <div style={{ color: "#3d4f70", fontSize: "0.5625rem", letterSpacing: "0.1em", marginBottom: 8 }}>
        {(p.month ?? "").toUpperCase()}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          ["closed", "#4ade80", "closed"],
          ["opened", "#60a5fa", "opened"],
          ["openAtEnd", "#94a3b8", "open total"],
          ["trendKey", "#f59e0b", "trend"],
        ]
          .filter(([k]) => p[k as keyof ChartRow] !== undefined)
          .map(([k, c, l]) => (
            <div key={k}>
              <div style={{ color: c, fontWeight: 600, fontSize: "1.125rem" }}>
                {typeof p[k as keyof ChartRow] === "number"
                  ? Number(p[k as keyof ChartRow]).toFixed(1)
                  : p[k as keyof ChartRow]}
              </div>
              <div style={{ color: "#8fa1bf", fontSize: "0.5625rem" }}>{l}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

const axisStyle = {
  fill: "#8fa1bf",
  fontSize: "0.5625rem",
  fontFamily: "IBM Plex Mono",
};
const gridStroke = "#0d1220";
const legendStyle = { fontSize: "0.625rem", fontFamily: "IBM Plex Mono", paddingTop: 12, color: "#3d4f70" };

interface ThroughputChartsProps {
  moData: ChartRow[];
  woData: ChartRow[] | null;
  stats: ChartStats;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  loading?: boolean;
}

type DatePreset = "all" | "last_6_months" | "last_3_months";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<DatePreset, "all">): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthsBack = preset === "last_3_months" ? 2 : 5; // include current month in the window
  const start = new Date(end.getFullYear(), end.getMonth() - monthsBack, 1);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function selectedPreset(range: DateRange): DatePreset {
  if (!range?.from || !range?.to) return "all";
  const last6 = presetRange("last_6_months");
  if (range.from === last6.from && range.to === last6.to) return "last_6_months";
  const last3 = presetRange("last_3_months");
  if (range.from === last3.from && range.to === last3.to) return "last_3_months";
  return "all";
}

export function ThroughputCharts({
  moData,
  woData,
  stats,
  dateRange,
  onDateRangeChange,
  loading = false,
}: ThroughputChartsProps) {
  const [chartView, setChartView] = useState(0);
  const [granularity, setGranularity] = useState<"MoM" | "WoW">("MoM");

  const data = granularity === "WoW" && woData && woData.length > 0 ? woData : moData;

  if (data.length === 0) {
    return <p style={{ color: "#9fb0cd" }}>No project data by {granularity === "WoW" ? "week" : "month"}.</p>;
  }

  const xInt = Math.max(0, Math.floor(data.length / 12) - 1);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {CHART_VIEWS.map((v, i) => (
            <button
              key={v}
              type="button"
              className="chart-tab"
              data-on={chartView === i}
              onClick={() => setChartView(i)}
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.6875rem", color: "#9fb0cd" }}>
            <label>
              Date range
              <select
                value={selectedPreset(dateRange)}
                onChange={(e) => {
                  const value = e.target.value as DatePreset;
                  if (value === "all") {
                    onDateRangeChange(null);
                    return;
                  }
                  onDateRangeChange(presetRange(value));
                }}
                style={{
                  marginLeft: 6,
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  color: "#e2e8f0",
                  padding: "6px 8px",
                  borderRadius: 4,
                  fontFamily: "inherit",
                }}
              >
                <option value="all">All</option>
                <option value="last_6_months">Last 6 months</option>
                <option value="last_3_months">Last 3 months</option>
              </select>
            </label>
            {loading && <span style={{ fontSize: "0.6875rem", color: "#9fb0cd" }}>Updating…</span>}
          </div>
          {woData && woData.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="chart-tab"
                data-on={granularity === "MoM"}
                onClick={() => setGranularity("MoM")}
              >
                MoM
              </button>
              <button
                type="button"
                className="chart-tab"
                data-on={granularity === "WoW"}
                onClick={() => setGranularity("WoW")}
              >
                WoW
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          background: "#0b0f1e",
          border: "1px solid #0f1525",
          borderRadius: 12,
          padding: "20px 10px 14px",
        }}
      >
        <div
          style={{
            color: "#8fa1bf",
            fontSize: "0.5625rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 14,
            paddingLeft: 12,
          }}
        >
          {subtitle(granularity, chartView)}
        </div>
        <ResponsiveContainer width="100%" height={290}>
          {chartView === 0 ? (
            <ComposedChart data={data} barGap={2} barCategoryGap="32%">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                tick={axisStyle}
                axisLine={{ stroke: "#0f1525" }}
                tickLine={false}
                interval={xInt}
              />
              <YAxis
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={20}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,91,219,0.04)" }} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="opened" name="Opened" fill="#1d4ed8" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              <Bar dataKey="closed" name="Closed" fill="#15803d" fillOpacity={0.9} radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="trendKey"
                name="regression"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
                strokeDasharray="5 3"
              />
            </ComposedChart>
          ) : chartView === 1 ? (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                tick={axisStyle}
                axisLine={{ stroke: "#0f1525" }}
                tickLine={false}
                interval={xInt}
              />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#3b5bdb", strokeWidth: 1 }} />
              <Legend wrapperStyle={legendStyle} />
              <Area
                type="monotone"
                dataKey="openAtEnd"
                name="Open (backlog)"
                fill="#172554"
                fillOpacity={0.45}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="cumClosed"
                name="Closed (cumulative)"
                stroke="#4ade80"
                strokeWidth={2}
                dot={{ r: 4, fill: "#4ade80", strokeWidth: 0 }}
              />
            </ComposedChart>
          ) : chartView === 2 ? (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                tick={axisStyle}
                axisLine={{ stroke: "#0f1525" }}
                tickLine={false}
                interval={xInt}
              />
              <YAxis
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={24}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,91,219,0.04)" }} />
              <ReferenceLine y={0} stroke="#1e2840" strokeWidth={1} />
              <Bar dataKey="delta" name="Net change" radius={[3, 3, 0, 0]}>
                {data.map((row) => (
                  <Cell
                    key={row.month}
                    fill={row.delta <= 0 ? "#15803d" : row.delta <= 3 ? "#c2410c" : "#991b1b"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="trendKey"
                name="regression"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
                strokeDasharray="4 3"
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                tick={axisStyle}
                axisLine={{ stroke: "#0f1525" }}
                tickLine={false}
                interval={xInt}
              />
              <YAxis
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={20}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,91,219,0.04)" }} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="closed" name={granularity === "WoW" ? "Closed / wk" : "Closed / mo"} radius={[3, 3, 0, 0]}>
                {data.map((row) => (
                  <Cell
                    key={row.month}
                    fill="#1d4ed8"
                    fillOpacity={row.closed > 0 ? 0.65 : 0.2}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="trendKey"
                name="regression"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
              />
              <ReferenceLine
                y={stats.velocityPerMonth}
                stroke="#3b5bdb"
                strokeDasharray="5 5"
                label={{
                  value: `avg ${stats.velocityPerMonth}/mo`,
                  fill: "#3b5bdb",
                  fontSize: "0.5625rem",
                  fontFamily: "IBM Plex Mono",
                }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
