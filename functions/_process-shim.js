// Minimal `process` shim. satori references `process` at module-eval time, and
// the Workers runtime has no `process` global (without nodejs_compat). This
// module is imported BEFORE satori in og.js so the global exists in time.
// Files prefixed with `_` are not treated as routes by Cloudflare Pages.
globalThis.process ??= { env: {} };
