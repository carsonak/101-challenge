/** @file Validate external API bundle destinations. Importing performs no I/O. */
import { access, mkdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

/** Return whether a path exists; permission failures remain actionable errors. */
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

/** Reject any destination inside a checkout, including paths reached through symlinks. */
async function rejectRepository(path) {
  let current = path;
  while (true) {
    if (await exists(resolve(current, ".git")))
      throw new Error("OpenAPI bundles must stay outside repositories");
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

/** Validate an absolute YAML destination and create only its external parent directory. */
export async function prepareOpenapiOutput(value) {
  if (!isAbsolute(value) || !/\.ya?ml$/.test(value))
    throw new Error("Supply an absolute external .yaml path");
  const output = resolve(value);
  await rejectRepository(dirname(output));
  let ancestor = dirname(output);
  while (!(await exists(ancestor))) ancestor = dirname(ancestor);
  await rejectRepository(await realpath(ancestor));
  if (await exists(output))
    await rejectRepository(dirname(await realpath(output)));
  await mkdir(dirname(output), { recursive: true });
  return output;
}
