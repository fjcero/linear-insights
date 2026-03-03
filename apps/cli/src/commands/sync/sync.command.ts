import chalk from "chalk";
import { syncLinearData } from "@linear-insights/report-data";

export async function runSyncCommand(options?: { forceRefresh?: boolean }): Promise<void> {
  try {
    process.stdout.write(chalk.dim("Syncing Linear data to cache…"));
    await syncLinearData({ forceRefresh: options?.forceRefresh ?? false });
    process.stdout.write(chalk.green(" done.\n"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red("\nSync failed:"), msg);
    if (err instanceof Error && err.stack) {
      console.error(chalk.dim(err.stack));
    }
    process.exit(1);
  }
}
