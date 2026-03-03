import type { ChangeEvent } from "react";

interface LoaderProps {
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  loading?: boolean;
}

export function Loader({ onFileSelect, error, loading = false }: LoaderProps) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem", color: "#38bdf8" }}>
        Linear Insights
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: "1.5rem", textAlign: "center", maxWidth: 380 }}>
        {loading
          ? "Loading report…"
          : "Report not available. Run from repo root so the app starts with the report API, or choose a file:"}
        {!loading && (
          <code style={{ display: "block", marginTop: "0.5rem", background: "#334155", padding: "0.375rem 0.5rem", borderRadius: 4 }}>bun run app:dev</code>
        )}
      </p>
      {!loading && (
      <label style={{
        display: "inline-block",
        padding: "0.5rem 1rem",
        background: "#3b82f6",
        color: "white",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 500,
      }}>
        Choose report.json
        <input
          type="file"
          accept=".json,application/json"
          onChange={onFileSelect}
          style={{ display: "none" }}
        />
      </label>
      )}
      {error && (
        <p style={{ color: "#f87171", marginTop: "1rem" }}>{error}</p>
      )}
    </div>
  );
}
