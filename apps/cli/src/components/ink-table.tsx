/** @jsxImportSource react */
import { Fragment } from "react";
import { Text, Box } from "ink";

type ScalarDict = Record<string, string | number | boolean | null | undefined>;

/** Optional: map column name → (cell value → ink color name). */
export type ColumnColors = Record<string, (value: string) => string | undefined>;

/**
 * Bordered table component for Ink.
 * Pass an array of objects; keys become column headers.
 * Optionally pass columnColors to color specific columns by cell value.
 */
export function InkTable<T extends ScalarDict>({
  data,
  columnColors,
}: {
  data: T[];
  columnColors?: ColumnColors;
}) {
  if (data.length === 0) return <Text dimColor>(no data)</Text>;

  const firstRow = data[0];
  const columns = (firstRow ? Object.keys(firstRow) : []) as (keyof T & string)[];

  const widths = columns.map((col) =>
    Math.max(
      col.length,
      ...data.map((row) => String(row[col] ?? "").length)
    )
  );

  const topBorder = "┌" + widths.map((w) => "─".repeat(w + 2)).join("┬") + "┐";
  const headerSep = "├" + widths.map((w) => "─".repeat(w + 2)).join("┼") + "┤";
  const bottomBorder = "└" + widths.map((w) => "─".repeat(w + 2)).join("┴") + "┘";

  const renderRow = (cells: string[]) =>
    "│" +
    cells
      .map((cell, i) => " " + cell.padEnd(widths[i] ?? 0) + " ")
      .join("│") +
    "│";

  const renderCell = (value: string, col: string, colIndex: number) => {
    const w = widths[colIndex] ?? 0;
    const padded = " " + value.padEnd(w) + " ";
    const color = columnColors?.[col]?.(value);
    return color ? <Text color={color}>{padded}</Text> : <Text>{padded}</Text>;
  };

  const rowKey = (row: T) => columns.map((c) => String(row[c] ?? "")).join("\0");

  return (
    <Box flexDirection="column">
      <Text>{topBorder}</Text>
      <Text bold>{renderRow(columns)}</Text>
      <Text>{headerSep}</Text>
      {data.map((row) => (
        <Box key={rowKey(row)} flexDirection="row">
          <Text>│</Text>
          {columns.map((col, i) => (
            <Fragment key={col}>
              {i > 0 && <Text>│</Text>}
              {renderCell(String(row[col] ?? ""), col, i)}
            </Fragment>
          ))}
          <Text>│</Text>
        </Box>
      ))}
      <Text>{bottomBorder}</Text>
    </Box>
  );
}
