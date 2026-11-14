// Compile tests in a temporary directory so Node 22 does not need a TS runtime dependency.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const out = mkdtempSync(join(tmpdir(), "lifeguessr-csv-"));
try {
  const compile = spawnSync(
    process.execPath,
    [
      "apps/web/node_modules/typescript/bin/tsc",
      "apps/web/src/lib/csv.test.ts",
      "--outDir",
      out,
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--strict",
      "--esModuleInterop",
      "--skipLibCheck",
      "--typeRoots",
      "apps/web/node_modules/@types",
    ],
    { stdio: "inherit" },
  );
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const run = spawnSync(
      process.execPath,
      ["--test", join(out, "csv.test.js")],
      { stdio: "inherit" },
    );
    process.exitCode = run.status ?? 1;
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}
