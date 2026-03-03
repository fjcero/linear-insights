import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { InsightsReportData } from "@linear-insights/report-types";

export const DEFAULT_REPORT_JSON_FILENAME = "linear-insights-report.json";

export function getReportJsonPath(): string {
  const env = process.env.LINEAR_INSIGHTS_JSON_OUTPUT;
  if (env?.trim()) return env.trim();
  return join(process.cwd(), DEFAULT_REPORT_JSON_FILENAME);
}

export async function writeReportJson(report: InsightsReportData, outputPath: string): Promise<void> {
  const json = JSON.stringify(report, null, 2);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, json, "utf-8");
}
