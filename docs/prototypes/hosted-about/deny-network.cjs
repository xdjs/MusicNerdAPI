// Preload only for offline build verification. No request contents or destinations are recorded.
const fs = require("node:fs");
const block = surface =>
  function () {
    if (process.env.SYNTHETIC_NETWORK_AUDIT)
      fs.appendFileSync(process.env.SYNTHETIC_NETWORK_AUDIT, `${surface}\n`);
    throw new Error(`Offline test build forbids network: ${surface}`);
  };
globalThis.fetch = block("fetch");
for (const name of ["node:http", "node:https"]) {
  const module = require(name);
  module.request = block(`${name}.request`);
  module.get = block(`${name}.get`);
}
require("node:net").Socket.prototype.connect = block("socket.connect");
require("node:tls").connect = block("tls.connect");
const dns = require("node:dns");
for (const key of ["lookup", "resolve", "resolve4", "resolve6"]) {
  dns[key] = block(`dns.${key}`);
  dns.promises[key] = block(`dns.promises.${key}`);
}
