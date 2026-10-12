/** @file Verify formatting preserves executable syntax, comment ownership and expression grouping. */
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

/** Compare token kind/text to detect any change beyond whitespace. */
function tokens(source: string) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.JSX,
    source
  );

  const result: [number, string][] = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  )
    result.push([token, scanner.getTokenText()]);

  return result;
}

test("statement separators preserve chains, comments, switch cases and expressions", async () => {
  const { statementSpacing, physicalLines } = await import(
    "../scripts/source-style.mjs" as string
  );

  const source = `function sample() {
  if (ready) {
    call();
  } else {
    other();
  }
  // The next declaration owns this comment.
  const value = {
    nested: [1, 2],
    other: true,
  };
  next(value);
  try {
    next();
  } catch (error) {
    recover(error);
  } finally {
    release();
  }
  switch (value) {
    case 1:
      next();
      break;
    default:
      other();
  }
  done();
}
/** Next function's documentation. */
function following() {}
`;

  const formatted = statementSpacing(source);
  assert.match(formatted, /}\n\n {2}\/\/ The next declaration/);
  assert.match(formatted, /};\n\n {2}next/);
  assert.match(formatted, /}\n\n {2}switch/);
  assert.match(formatted, /}\n\n\/\*\* Next function/);
  assert.ok(formatted.includes("} else {"));
  assert.ok(formatted.includes("} catch (error) {"));
  assert.ok(formatted.includes("} finally {"));
  assert.ok(formatted.includes("break;\n    default:"));
  assert.ok(formatted.includes("nested: [1, 2],\n    other: true,"));
  assert.equal(statementSpacing(formatted), formatted);
  assert.deepEqual(tokens(formatted), tokens(source));
  assert.equal(physicalLines("a\n\nb\n"), 3);
});

test("TSX, trailing comments and multiline calls retain tokens and are idempotent", async () => {
  const { statementSpacing } = await import(
    "../scripts/source-style.mjs" as string
  );

  const source = `const render = () => {
  send(
    first,
    second
  ); // Previous statement's comment.
  return <Card>{value}</Card>;
};
/** Consumer documentation. */
export const use = render;
`;

  const formatted = statementSpacing(source, "fixture.tsx");
  assert.match(formatted, /comment\.\n\n {2}return/);
  assert.equal(statementSpacing(formatted, "fixture.tsx"), formatted);
  assert.deepEqual(tokens(formatted), tokens(source));
});
