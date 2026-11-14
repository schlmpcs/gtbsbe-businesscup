// Prefer the user's Python; fall back when its XML runtime is broken.
import { spawnSync } from "node:child_process";
const candidates = [process.env.PYTHON, "python3", "/usr/bin/python3"].filter(
  Boolean,
);
const python = candidates.find(
  (command) =>
    spawnSync(
      command,
      ["-c", 'import xml.etree.ElementTree as E; E.fromstring("<ok/>")'],
      { stdio: "ignore" },
    ).status === 0,
);
if (!python) {
  console.error(
    "A working Python 3 XML runtime is required. Set PYTHON to its executable.",
  );
  process.exit(1);
}
const result = spawnSync(python, process.argv.slice(2), { stdio: "inherit" });
process.exitCode = result.status ?? 1;
