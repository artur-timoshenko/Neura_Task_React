// DEV-only logger. In production builds, log/info/debug are no-ops.
// Errors and warnings always go through so real problems remain visible.
const isDev = import.meta.env.DEV;

export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  info: isDev ? console.info.bind(console) : () => {},
  debug: isDev ? console.debug.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
