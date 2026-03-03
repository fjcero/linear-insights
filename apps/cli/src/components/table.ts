/**
 * Reusable table formatter for CLI/reports.
 */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => (c ?? "").padEnd(widths[i] ?? 0)).join("  ");
  const sep = widths.map((w) => "─".repeat(w)).join("──");
  return [line(headers), sep, ...rows.map((r) => line(r))].join("\n");
}
