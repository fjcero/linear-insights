#!/usr/bin/env bun
/**
 * Bundles API routes that import workspace packages (which export raw TS).
 * Vercel's Node runtime cannot execute .ts files, so we bundle report.ts
 * and its transitive deps into a single .js file.
 */
export {};
const proc = Bun.spawn(["bun", "build", "api/report.ts", "--outdir=api", "--target=node"], {
  stdout: "inherit",
  stderr: "inherit",
});
const exit = await proc.exited;
if (exit !== 0) process.exit(exit);
console.log("api/report.js bundled successfully");
