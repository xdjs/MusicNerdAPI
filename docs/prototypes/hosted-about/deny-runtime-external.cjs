// Local smoke-test preload only; never a hosted auth or egress override.
require("./deny-network.cjs");
// Node's listener resolves its literal bind address through this API; answer locally only.
const dns = require("node:dns");
const deniedLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (hostname !== "127.0.0.1") return deniedLookup(hostname, options, callback);
  const cb = typeof options === "function" ? options : callback;
  queueMicrotask(() =>
    options?.all ? cb(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4),
  );
};
const Module = require("node:module");
const path = require("node:path");
const root = require("node:fs").realpathSync(process.env.SYNTHETIC_RUNTIME_ROOT);
const original = Module._resolveFilename;
Module._resolveFilename = function (...args) {
  const resolved = original.apply(this, args);
  if (path.isAbsolute(resolved) && !resolved.startsWith(root + path.sep))
    throw new Error("Runtime module escaped the relocated synthetic bundle");
  return resolved;
};
