import type { TrackerErrorCode } from "@challenge/contracts";

/** Safe service failure code; messages never contain participant data. */
export class DomainError extends Error {
  /** Machine-readable code shared by both adapters. */
  readonly code: TrackerErrorCode;
  constructor(code: TrackerErrorCode) {
    super(code);
    this.name = "DomainError";
    this.code = code;
  }
}

/** Require an invariant without disclosing the rejected data. */
export function requireRule(
  condition: unknown,
  code: TrackerErrorCode
): asserts condition {
  if (!condition) throw new DomainError(code);
}

/** Injected time and entropy make transactions deterministic under retries and tests. */
export interface TrackerOptions {
  /** Server-owned timezone for new participation. */
  timezone?: string;
  /** Clock resolved once per logical mutation. */
  now?: () => Date;
  /** UUID source for new resource identities. */
  id?: () => string;
  /** Private 32-byte entropy source, represented by lowercase hex. */
  secret?: () => string;
}

/** Read transaction records sequentially; one PostgreSQL connection owns the callback. */
export async function mapInOrder<T, R>(
  values: T[],
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const result: R[] = [];
  for (const value of values) result.push(await mapper(value));

  return result;
}
