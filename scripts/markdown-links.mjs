/** @file Markdown link validation used by documentation checks; performs no I/O. */

/** Find local link targets and malformed Markdown-file references, excluding code. */
export function markdownLinks(body) {
  const prose = body
    .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")
    .replace(/`+[^`\n]*`+/g, "");
  const definitions = new Map(
    [...prose.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/gm)].map((m) => [
      m[1].toLowerCase(),
      m[2],
    ])
  );
  const targets = [
    ...prose.matchAll(/\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+["'][^\n]*?["'])?\)/g),
  ].map((m) => m[1]);
  const malformed = [];
  for (const m of prose.matchAll(/(?<!!)\[([^\]\n]+\.md)\](?!\()/gi)) {
    const tail = prose.slice(m.index + m[0].length);
    if (tail.startsWith(":")) continue;
    const ref = /^\[([^\]]*)\]/.exec(tail);
    const key = (ref?.[1] || m[1]).toLowerCase();
    if (definitions.has(key)) targets.push(definitions.get(key));
    else malformed.push(m[1]);
  }
  return { targets, malformed };
}
