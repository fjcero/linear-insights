import chalk from "chalk";

const BAR_WIDTH = 16;
const BAR_CHAR = "█";
const BAR_EMPTY = "░";

/** Render a simple horizontal bar chart for created/closed by month (ASCII). */
export function velocityBarChart(
  buckets: { month: string; created: number; closed: number }[],
  formatMonth: (key: string) => string
): string[] {
  if (buckets.length === 0) return [];
  const maxVal = Math.max(1, ...buckets.flatMap((b) => [b.created, b.closed]));
  const lines: string[] = [];
  for (const b of buckets) {
    const label = formatMonth(b.month).padEnd(10);
    const createdLen = Math.round((b.created / maxVal) * BAR_WIDTH);
    const closedLen = Math.round((b.closed / maxVal) * BAR_WIDTH);
    const createdBar = BAR_CHAR.repeat(createdLen) + BAR_EMPTY.repeat(BAR_WIDTH - createdLen);
    const closedBar = BAR_CHAR.repeat(closedLen) + BAR_EMPTY.repeat(BAR_WIDTH - closedLen);
    lines.push(`  ${chalk.cyan(label)} Created ${chalk.blue(createdBar)} ${b.created}`);
    lines.push(`  ${" ".repeat(10)} Closed  ${chalk.green(closedBar)} ${b.closed}`);
  }
  return lines;
}
