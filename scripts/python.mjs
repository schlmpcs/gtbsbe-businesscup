#!/usr/bin/env node
// Runs a Python 3 script for the data pipeline (packages/data/scripts): `node scripts/python.mjs <script> [args]`.
// Prefers $PYTHON, then python3, then /usr/bin/python3, skipping any whose XML runtime is broken
// (the pipeline reads xlsx workbooks with the standard library only, no pip packages).
import { spawnSync } from 'node:child_process';

const candidates = [process.env.PYTHON, 'python3', '/usr/bin/python3'].filter(Boolean);
const python = candidates.find(
  (command) =>
    spawnSync(command, ['-c', 'import xml.etree.ElementTree as E; E.fromstring("<ok/>")'], { stdio: 'ignore' })
      .status === 0,
);
if (!python) {
  console.error('A working Python 3 (with its XML runtime) is required. Set PYTHON to its executable.');
  process.exit(1);
}
const result = spawnSync(python, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
