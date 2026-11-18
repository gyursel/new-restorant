import { execFileSync } from "node:child_process";
if (process.env.VERCEL_ENV === "preview" || process.argv.includes("--local")) {
  const cwd = new URL("./staff-review/", import.meta.url);
  execFileSync("npm", ["ci", "--no-audit", "--no-fund"], {
    cwd,
    stdio: "inherit",
  });
  execFileSync(process.execPath, ["build.mjs"], { cwd, stdio: "inherit" });
}
