import ts from "../apps/web/node_modules/typescript/lib/typescript.js";
import { readdir, readFile } from "node:fs/promises";
async function walk(dir) {
  let result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await walk(name)));
    else if (/\.tsx?$/.test(name)) result.push(name);
  }
  return result;
}
const errors = [];
for (const file of await walk("apps/web/src/features")) {
  if (!file.includes("/ui/")) continue;
  const source = ts.createSourceFile(
    file,
    await readFile(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function check(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const name = node.moduleSpecifier?.text;
      if (
        name &&
        !/^(@\/ui-kit(?:\/.*)?|@\/copy|\.\.\/model\/types)$/.test(name)
      )
        errors.push(`${file}: disallowed UI import ${name}`);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    )
      errors.push(`${file}: dynamic UI imports are prohibited`);
    ts.forEachChild(node, check);
  }
  check(source);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("UI import boundaries pass");
