import { useState } from "react";

interface GridRow {
  ProjectId?: string;
  Project: string;
  State: string;
  Risk: string;
  Started?: string;
  "Now for (days)"?: string;
  Target?: string;
  Issues?: string;
  "% done"?: string;
  "Last activity"?: string;
  "Days left": string;
}

interface ProjectGridProps {
  rows: GridRow[];
  trendPerMonth?: number;
  updatesByProject?: Record<string, { Date: string; Author: string; Summary: string }[]>;
}

function trendBasedCompletion(pctDone: string | undefined, trendPerMonth: number): string {
  const pct = Number.parseInt((pctDone ?? "").replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(pct)) return "—";
  if (pct >= 100) return "Done";
  const safeTrend = Math.max(0.1, trendPerMonth);
  const remaining = 100 - pct;
  const monthsLeft = remaining / safeTrend;
  const daysLeft = Math.ceil(monthsLeft * 30);
  const d = new Date();
  d.setDate(d.getDate() + daysLeft);
  return d.toISOString().slice(0, 10);
}

const COLUMNS: ("Now" | "Next" | "Later")[] = ["Now", "Next", "Later"];

function riskColor(risk: string): string {
  if (risk === "On track") return "#4ade80";
  if (risk === "At risk") return "#f97316";
  if (risk === "Off track") return "#ef4444";
  return "#64748b";
}

function progressColor(progress: string | undefined): string {
  const pct = Number.parseInt((progress ?? "").replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(pct)) return "#9fb0cd";
  if (pct < 30) return "#ef4444";
  if (pct < 69) return "#f59e0b";
  return "#4ade80";
}

export function ProjectGrid({ rows, trendPerMonth = 1, updatesByProject = {} }: ProjectGridProps) {
  const byState = COLUMNS.map((state) => rows.filter((r) => r.State === state));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  function toggleCard(key: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div style={{ marginTop: 36 }}>
      <h2
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "1rem",
          fontWeight: 600,
          color: "#c4cde0",
          letterSpacing: "-0.01em",
          marginBottom: 14,
          marginTop: 0,
        }}
      >
        Project grid <span style={{ color: "#9fb0cd", fontWeight: 400, fontSize: "0.8125rem" }}>· Now / Next / Later</span>
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        {COLUMNS.map((state, colIndex) => (
          <div
            key={state}
            style={{
              padding: "0 2px",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: state === "Now" ? "#60a5fa" : state === "Next" ? "#a78bfa" : "#94a3b8",
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {state}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {byState[colIndex].length === 0 ? (
                <div style={{ color: "#8fa1bf", fontSize: "0.6875rem" }}>—</div>
              ) : (
                byState[colIndex].map((r, i) => (
                  <button
                    key={r.ProjectId ? `${r.ProjectId}-${i}` : `${r.Project}-${i}`}
                    type="button"
                    onClick={() => toggleCard(r.ProjectId ? `${state}:${r.ProjectId}:${i}` : `${state}:${r.Project}:${i}`)}
                    onMouseEnter={() => setHoveredCard(r.ProjectId ? `${state}:${r.ProjectId}:${i}` : `${state}:${r.Project}:${i}`)}
                    onMouseLeave={() =>
                      setHoveredCard((current) =>
                        current === (r.ProjectId ? `${state}:${r.ProjectId}:${i}` : `${state}:${r.Project}:${i}`)
                          ? null
                          : current
                      )
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      position: "relative",
                      background:
                        hoveredCard === (r.ProjectId ? `${state}:${r.ProjectId}:${i}` : `${state}:${r.Project}:${i}`)
                          ? "#0b1324"
                          : "#080d1a",
                      border:
                        hoveredCard === (r.ProjectId ? `${state}:${r.ProjectId}:${i}` : `${state}:${r.Project}:${i}`)
                          ? "1px solid #2a4676"
                          : "1px solid #0f1525",
                      borderRadius: 8,
                      padding: "14px 14px",
                      cursor: "pointer",
                      transition: "background 120ms ease, border-color 120ms ease",
                    }}
                  >
                    {(() => {
                      const cardKey = r.ProjectId ? `${state}:${r.ProjectId}:${i}` : `${state}:${r.Project}:${i}`;
                      const updates =
                        (r.ProjectId ? updatesByProject[r.ProjectId] : undefined) ??
                        updatesByProject[r.Project] ??
                        [];
                      const isOpen = expanded.has(cardKey);
                      const progress = r["% done"] ?? "—";
                      return (
                        <>
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {state !== "Later" && (
                        <span
                          style={{
                            fontSize: "0.875rem",
                            lineHeight: 1,
                            color: progressColor(progress),
                            fontWeight: 700,
                            fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                          }}
                        >
                          {progress}
                        </span>
                      )}
                      {state !== "Later" && r.Risk !== "—" && (
                        <span
                          style={{
                            fontSize: "0.5625rem",
                            lineHeight: 1,
                            padding: "3px 6px",
                            borderRadius: 999,
                            background: "transparent",
                            color: riskColor(r.Risk),
                            border: `1px solid ${riskColor(r.Risk)}88`,
                            fontWeight: 600,
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                          }}
                        >
                          {r.Risk}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#e2e8f0",
                        marginBottom: 8,
                        maxWidth: "68%",
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {r.Project}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#9fb0cd", marginBottom: 4 }}>
                      Issues: {r.Issues ?? "—"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#9fb0cd", marginBottom: 4 }}>
                      Target: {r.Target ?? "—"}
                    </div>
                    {state === "Now" ? (
                      <>
                        <div style={{ fontSize: "0.75rem", color: "#9fb0cd", marginBottom: 4 }}>
                          Started: {r.Started ?? "—"} · Now for: {r["Now for (days)"] ?? "—"}d
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#9fb0cd" }}>
                          Est. completion (trend): {trendBasedCompletion(r["% done"], trendPerMonth)}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "0.75rem", color: "#9fb0cd" }}>
                        Last activity: {r["Last activity"] ?? "—"}
                      </div>
                    )}
                          <div style={{ fontSize: "0.75rem", color: "#b2c0d8", marginTop: 10 }}>
                            {updates.length} update{updates.length === 1 ? "" : "s"} {updates.length > 0 ? (isOpen ? "▲" : "▼") : ""}
                          </div>
                          {isOpen && updates.length > 0 && (
                            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                              {updates.map((u) => (
                                <div key={`${cardKey}-${u.Date}-${u.Author}-${u.Summary.slice(0, 24)}`} style={{ borderTop: "1px solid #12203a", paddingTop: 8 }}>
                                  <div style={{ fontSize: "0.6875rem", color: "#9fb0cd", marginBottom: 4 }}>
                                    {u.Date} · {u.Author}
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "#d9e1ee", lineHeight: 1.45 }}>{u.Summary}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
