export const TERMINAL_PROJECT_STATES = ["completed", "canceled"] as const;

const ACTIVE_PROJECT_STATE_ORDER: Record<string, number> = {
  started: 0,
  planned: 1,
  backlog: 2,
};

export function isTerminalProjectState(state: string | null | undefined): boolean {
  const lower = (state ?? "").toLowerCase();
  return TERMINAL_PROJECT_STATES.includes(
    lower as (typeof TERMINAL_PROJECT_STATES)[number]
  );
}

export function projectStateSortOrder(state: string | null | undefined): number {
  return ACTIVE_PROJECT_STATE_ORDER[(state ?? "").toLowerCase()] ?? 99;
}

export function sortProjectsByState<T extends { state?: string | null }>(projects: T[]): T[] {
  return [...projects].sort(
    (a, b) => projectStateSortOrder(a.state) - projectStateSortOrder(b.state)
  );
}
