interface Row {
  Project: string;
  Issue: string;
  "Days since update": string;
  "Last update": string;
}

export function StaleIssuesTable({ data }: { data: Row[] }) {
  const cols = ["Issue", "Days since update", "Last update"] as const;
  const grouped = new Map<string, Row[]>();
  for (const row of data) {
    const key = row.Project || "Unknown project";
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const projects = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {projects.map((project) => {
        const rows = grouped.get(project) ?? [];
        return (
          <div key={project} style={{ overflowX: "auto" }}>
            <div
              style={{
                color: "#9fb0cd",
                fontSize: "0.75rem",
                letterSpacing: "0.04em",
                marginBottom: 6,
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {project}
            </div>
            <table className="report-table" style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "68%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${project}-${row.Issue}-${i}`}>
                    {cols.map((c) => (
                      <td
                        key={c}
                        style={
                          c === "Issue"
                            ? { whiteSpace: "normal", overflowWrap: "anywhere" }
                            : undefined
                        }
                      >
                        {row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
