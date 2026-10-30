const { parentPort } = require("node:worker_threads");
module.exports = () => {
  parentPort.postMessage({ type: "test-started" });
  for (;;) {
    /* Deliberate synchronous CPU fixture, confined to a worker. */
  }
};
