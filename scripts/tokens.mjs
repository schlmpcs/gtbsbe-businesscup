import { readFile, writeFile } from "node:fs/promises";
const tokens = JSON.parse(
  await readFile(new URL("../tokens.json", import.meta.url)),
);
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
await writeFile(
  new URL("../apps/web/src/ui-kit/tokens.css", import.meta.url),
  `:root {\n${Object.entries(tokens.colors)
    .map(([key, value]) => `  --${kebab(key)}: ${value};`)
    .join(
      "\n",
    )}\n  --radius: ${tokens.radius};\n  --space: ${tokens.space};\n}\n`,
);
