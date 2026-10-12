/** @file Check/fix TypeScript statement spacing and enforce production file sizes. Run source:check or source:format; importing performs no work. */
import ts from "typescript";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Find statement separators without changing expressions, comments or chained blocks. */
export function statementSpacing(source, filename = "source.ts") {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const insertions = new Set();
  /** Inspect sibling statements; complete control-flow chains remain one node. */
  function inspect(node) {
    if (
      ts.isSourceFile(node) ||
      ts.isBlock(node) ||
      ts.isCaseClause(node) ||
      ts.isDefaultClause(node)
    ) {
      const statements = node.statements;
      for (let index = 0; index < statements.length - 1; index++) {
        const previous = statements[index];
        const next = statements[index + 1];
        if (
          ts.isImportDeclaration(previous) ||
          ts.isImportEqualsDeclaration(previous)
        )
          continue;
        const text = previous.getText(file);
        const braced =
          ts.isFunctionDeclaration(previous) ||
          ts.isClassDeclaration(previous) ||
          ts.isInterfaceDeclaration(previous) ||
          ts.isBlock(previous) ||
          ts.isIfStatement(previous) ||
          ts.isSwitchStatement(previous) ||
          ts.isTryStatement(previous) ||
          ts.isForStatement(previous) ||
          ts.isForOfStatement(previous) ||
          ts.isForInStatement(previous) ||
          ts.isWhileStatement(previous) ||
          ts.isDoStatement(previous);
        if (!braced && !text.includes("\n")) continue;
        const gap = source.slice(previous.end, next.getStart(file));
        if (/\n[\t ]*\r?\n/.test(gap)) continue;
        // A comment on the previous statement's line belongs to that statement.
        const trailing =
          ts.getTrailingCommentRanges(source, previous.end) ?? [];
        const end = trailing.length ? trailing.at(-1).end : previous.end;
        const newline = source.indexOf("\n", end);
        if (newline >= 0 && newline < next.getStart(file))
          insertions.add(newline + 1);
        else insertions.add(end);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(file);
  let result = source;
  for (const position of [...insertions].sort((a, b) => b - a)) {
    const padding = source[position - 1] === "\n" ? "\n" : "\n\n";
    result = result.slice(0, position) + padding + result.slice(position);
  }
  return result;
}

/** Count physical lines without treating the final line terminator as an extra line. */
export function physicalLines(source) {
  return source === ""
    ? 0
    : source.split("\n").length - Number(source.endsWith("\n"));
}

/** Inspect handwritten source; generated outputs and declarations are excluded. */
async function discover(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      ["node_modules", "dist", ".next", ".git", "coverage"].includes(entry.name)
    )
      continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await discover(path)));
    else if (
      /\.(?:[cm]?[jt]sx?|css)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    )
      files.push(path);
  }
  return files;
}

/** Check source formatting; --write inserts separators and never restructures executable syntax. */
export async function checkSources(write = false) {
  const errors = [];
  for (const root of ["apps", "packages", "scripts", "tests"]) {
    for (const file of await discover(root)) {
      let source = await readFile(file, "utf8");
      if (/\.tsx?$/.test(file)) {
        const formatted = statementSpacing(source, file);
        if (formatted !== source) {
          if (write) await writeFile(file, formatted);
          else errors.push(`${file}: missing statement separator`);
          source = formatted;
        }
      }
      if (root !== "tests" && physicalLines(source) > 300)
        errors.push(`${file}: ${physicalLines(source)} lines exceeds 300`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.info("Statement spacing and production file limits verified");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await checkSources(process.argv.includes("--write"));
