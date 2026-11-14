// What the live forecast eval reads from `.env` files (apps/web/vitest.eval.config.ts reads the
// files; this is the merge, kept apart and free of imports so the config can load it and a unit
// test can reach it).

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The variables to hand the eval's tests (`test.env`): the files merged in order, a later file
 * winning, minus every name the shell already sets, so the shell wins. A shell value that is empty
 * or blank counts as unset: `export ANTHROPIC_API_KEY=` must not hide the key in `.env`. Names a
 * file declares without a value are left out.
 */
export function evalEnvFrom(files: readonly Env[], shell: Env): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const file of files) {
    for (const [name, value] of Object.entries(file)) {
      if (value !== undefined) merged[name] = value;
    }
  }
  for (const name of Object.keys(merged)) {
    if (shell[name]?.trim()) delete merged[name];
  }
  return merged;
}
