import { useCallback, useEffect, useState } from "react";
import type { InsightsReportData } from "@linear-insights/report-types";
import { Dashboard } from "./Dashboard";
import { Loader } from "./components/Loader";

export type DateRange = { from: string; to: string } | null;
export type TeamFilter = "all" | string;

function parseReport(json: string): InsightsReportData | null {
  try {
    const data = JSON.parse(json) as InsightsReportData;
    if (!data.teams || !data.unified || !data.velocity) return null;
    return data;
  } catch {
    return null;
  }
}

function reportUrl(dateRange: DateRange, team: TeamFilter): string {
  const params = new URLSearchParams();
  if (dateRange?.from && dateRange?.to) {
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
  }
  if (team !== "all") params.set("team", team);
  const qs = params.toString();
  return qs ? `/report?${qs}` : "/report";
}

export default function App() {
  const [report, setReport] = useState<InsightsReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamFilter>("all");
  const [reportSource, setReportSource] = useState<"api" | "file" | null>(null);

  const loadFromApi = useCallback(async (range: DateRange, team: TeamFilter) => {
    const url = reportUrl(range, team);
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Cache empty. Ensure LINEAR_API_KEY is set and restart.");
      }
      throw new Error(`Report failed: ${res.status}`);
    }
    const data = parseReport(await res.text());
    if (data) return data;
    throw new Error("Invalid report from server");
  }, []);

  useEffect(() => {
    const RETRY_DELAY_MS = 1500;
    const MAX_RETRIES = 40; // sync can take >1 min for large workspaces

    type LoadResult = { data: InsightsReportData; source: "api" | "file" } | null;
    async function loadReport(): Promise<LoadResult> {
      let lastApiError: Error | null = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const data = await loadFromApi(null, "all");
          if (data) return { data, source: "api" };
        } catch (err) {
          lastApiError = err instanceof Error ? err : new Error("Failed to load report API");
          if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
      try {
        const res = await fetch("/report.json");
        if (res.ok) {
          const data = parseReport(await res.text());
          if (data) return { data, source: "file" };
        }
      } catch {
        // ignore
      }
      if (lastApiError) {
        setError(lastApiError.message);
      } else {
        setError("Report not available from API or /report.json");
      }
      return null;
    }

    loadReport()
      .then((result) => {
        if (result) {
          setReport(result.data);
          setReportSource(result.source);
          setError(null);
        }
      })
      .finally(() => setLoading(false));
  }, [loadFromApi]);

  const onDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range);
      if (reportSource !== "api") return;
      setLoading(true);
      loadFromApi(range, selectedTeam)
        .then(setReport)
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report"))
        .finally(() => setLoading(false));
    },
    [loadFromApi, reportSource, selectedTeam]
  );

  const onTeamChange = useCallback(
    (teamId: TeamFilter) => {
      setSelectedTeam(teamId);
      if (reportSource !== "api") return;
      setLoading(true);
      loadFromApi(dateRange, teamId)
        .then(setReport)
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report"))
        .finally(() => setLoading(false));
    },
    [dateRange, loadFromApi, reportSource]
  );

  const loadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = parseReport(reader.result as string);
      if (data) {
        setReport(data);
        setReportSource("file");
      } else {
        setError("Invalid report: missing teams, unified, or velocity, or invalid JSON.");
      }
    };
    reader.readAsText(file);
  }, []);

  if (report) {
    return (
      <Dashboard
        report={report}
        onReset={() => {
          setReport(null);
          setReportSource(null);
          setDateRange(null);
          setSelectedTeam("all");
        }}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        selectedTeam={selectedTeam}
        onTeamChange={onTeamChange}
        loading={loading}
      />
    );
  }

  return (
    <Loader onFileSelect={loadFile} error={error} loading={loading} />
  );
}
