/**
 * Production-safe logger.
 *
 * - In development (`__DEV__ === true`) all logs are forwarded to the console.
 * - In release builds (`__DEV__ === false`) `log`, `info` and `debug` are no-ops
 *   so user PII (emails, tokens, server responses) never leaks via tools like
 *   `idevicesyslog` / Crashlytics breadcrumbs.
 * - `warn` and `error` are kept so genuine problems remain visible to crash
 *   reporters but they are scrubbed of obvious secrets first.
 *
 * Replace `console.log` usage in production-critical code paths with these
 * helpers (see App Store Guideline 5.1.2 — Data Use and Sharing).
 */

const SECRET_KEY_PATTERN = /(token|authorization|password|secret|jwt|cookie|bearer)/i;

function scrub(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (SECRET_KEY_PATTERN.test(value) && value.length > 8) {
      return '[redacted]';
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = scrub(v);
      }
    }
    return out;
  }
  return value;
}

function safeArgs(args: unknown[]): unknown[] {
  if (__DEV__) return args;
  return args.map(scrub);
}

export const logger = {
  log: (...args: unknown[]) => {
    if (__DEV__) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (__DEV__) console.info(...args);
  },
  debug: (...args: unknown[]) => {
    if (__DEV__) console.debug(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...safeArgs(args));
  },
  error: (...args: unknown[]) => {
    console.error(...safeArgs(args));
  },
};

export default logger;
