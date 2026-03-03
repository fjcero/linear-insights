/** @jsxImportSource react */
import type { ReactNode } from "react";
import { render, Text, Box } from "ink";
import { InkTable as Table, type ColumnColors } from "./ink-table.js";
import type { InsightsReportData } from "@linear-insights/report-types";

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text bold>
      {children}
    </Text>
  );
}

function TrendText({ trend, trendPreviousTotal, trendRecentTotal }: { trend: string; trendPreviousTotal: number; trendRecentTotal: number }) {
  const label =
    trend === "accelerating" ? "Accelerating" : trend === "slowing" ? "Slowing" : trend === "steady" ? "Steady" : "—";
  const numeric =
    trendPreviousTotal > 0 || trendRecentTotal > 0
      ? ` (closed: last 2 months ${trendRecentTotal} vs previous 2 months ${trendPreviousTotal})`
      : "";
  const color = trend === "accelerating" ? "green" : trend === "slowing" ? "red" : trend === "steady" ? "blue" : "gray";
  return (
    <Text>
      <Text bold>Trend: </Text>
      <Text color={color}>{label}{numeric}</Text>
    </Text>
  );
}

const unifiedTableColors: ColumnColors = {
  State: (value) => {
    switch (value) {
      case "Now":
        return "green";
      case "Next":
        return "yellow";
      case "Later":
        return "gray";
      case "Completed":
        return "magenta";
      default:
        return undefined;
    }
  },
  Risk: (value) => {
    switch (value) {
      case "On track":
        return "green";
      case "At risk":
        return "yellow";
      case "Off track":
        return "red";
      default:
        return "gray";
    }
  },
};

const dateSummaryColors: ColumnColors = {
  "# changes": (value) => {
    const n = Number(value);
    if (n === 0) return "gray";
    if (n <= 2) return "yellow";
    return "red";
  },
};

export function InsightsReport({ report }: { report: InsightsReportData }) {
  const {
    teams,
    showAllProjectsMessage,
    lifecycle,
    unified,
    objectivesOverSixWeeks,
    staleIssues,
    velocity,
    chartPath,
    dateSummary,
    activityLog,
  } = report;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {"\n Linear Insights\n"}
      </Text>

      {teams.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <SectionTitle>Teams</SectionTitle>
          <Table data={teams} />
        </Box>
      )}

      {showAllProjectsMessage && (
        <Box marginBottom={1}>
          <Text color="yellow">{showAllProjectsMessage}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        <SectionTitle>Projects (unified)</SectionTitle>
        <Table
          data={unified}
          columnColors={unifiedTableColors}
        />
      </Box>

      {dateSummary && dateSummary.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <SectionTitle>Project date tracking (original → current)</SectionTitle>
          <Table data={dateSummary} columnColors={dateSummaryColors} />
        </Box>
      )}

      {activityLog && activityLog.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <SectionTitle>Project activity log (date changes + status updates)</SectionTitle>
          {activityLog.map((project) => (
            <Box key={project.projectName} flexDirection="column" marginBottom={1}>
              <Text bold color="blue">  {project.projectName}</Text>
              {project.entries.length > 0 ? (
                <Table data={project.entries} />
              ) : (
                <Text color="gray">  No date changes or status updates.</Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      {lifecycle.buckets.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <SectionTitle>Accumulated over time (by month)</SectionTitle>
          <Table data={lifecycle.buckets} />
        </Box>
      )}

      {objectivesOverSixWeeks.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <SectionTitle>Objectives over 6 weeks (ideally ≤6 weeks each)</SectionTitle>
          <Table data={objectivesOverSixWeeks} />
        </Box>
      )}

      {staleIssues.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <SectionTitle>Stale issues (created 6+ weeks ago, no update in 6+ weeks)</SectionTitle>
          <Table data={staleIssues} />
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        <SectionTitle>Velocity (projects created / closed by month)</SectionTitle>
        {velocity.buckets.length === 0 ? (
          <Text color="gray">  No project data by month.</Text>
        ) : (
          <>
            <TrendText
              trend={velocity.trend}
              trendPreviousTotal={velocity.trendPreviousTotal}
              trendRecentTotal={velocity.trendRecentTotal}
            />
          </>
        )}
      </Box>

      <Text color="green">Done.</Text>
      <Text>{"\n"}</Text>
    </Box>
  );
}

export function renderInsightsReport(report: InsightsReportData): Promise<void> {
  const instance = render(<InsightsReport report={report} />, { exitOnCtrlC: true });
  // Static report: nothing unmounts the tree, so waitUntilExit() would never resolve.
  // Unmount after the first paint so the CLI exits promptly.
  setImmediate(() => instance.unmount());
  return instance.waitUntilExit();
}
