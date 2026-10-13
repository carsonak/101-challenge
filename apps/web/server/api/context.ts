import type { Throttle } from "@challenge/core";
import type { ApiDependencies } from "./transport";
/** Per-service HTTP dependencies and transport helpers. */
export interface ApiContext extends ApiDependencies {
  /** Separate bounded shared rate buckets. */ rates: Throttle;
  /** Cheap per-process rejection before anonymous payload validation and database work. */ ingressRates: import("@challenge/core").Throttle;
  /** Select a trusted address without accepting forwarding spoofing. */ address: (
    request: Request
  ) => string;
  /** Set session cookies after a successful proof. */ loginCookies: (
    response: Response,
    session: { token: string; csrf: string }
  ) => void;
}

/** Transient request context; never persisted or logged wholesale. */
export interface RequestContext {
  /** Incoming bounded transport. */ request: Request;
  /** Parsed route. */ url: URL;
  /** Exact route path. */ path: string;
  /** Opaque session cookie. */ token?: string;
  /** Submitted CSRF proof. */ csrf?: string;
  /** Record an exception for redacted diagnostics. */ recordError: (
    error: unknown
  ) => void;
}
