/** @file Copy generated static assets beside the standalone production server after next build. No source files are modified. */
import { cp, mkdir } from "node:fs/promises";
/** Generated monorepo standalone server owns this directory. */
const target = new URL(
  "../apps/web/.next/standalone/apps/web/.next/static/",
  import.meta.url
);
await mkdir(target, { recursive: true });
await cp(new URL("../apps/web/.next/static/", import.meta.url), target, {
  recursive: true,
});
