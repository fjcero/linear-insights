import chalk from "chalk";

export function healthColor(status: string): (s: string) => string {
  switch (status) {
    case "on_track":
      return chalk.green;
    case "at_risk":
      return chalk.yellow;
    case "off_track":
      return chalk.red;
    default:
      return chalk.gray;
  }
}

export function trendColor(trend: string): (s: string) => string {
  switch (trend) {
    case "accelerating":
      return chalk.green;
    case "slowing":
      return chalk.red;
    case "steady":
      return chalk.blue;
    default:
      return chalk.gray;
  }
}
