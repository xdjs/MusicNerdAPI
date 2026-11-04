import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const records = JSON.parse(
  readFileSync(new URL("./migration-fixtures.json", import.meta.url), "utf8"),
);
for (const record of records) {
  const contents = readFileSync(new URL(record.fixture, import.meta.url));
  if (createHash("sha256").update(contents).digest("hex") !== record.sha256)
    throw new Error(`Synthetic migration fixture checksum mismatch: ${record.file}`);
}
console.log(`Verified ${records.length} repository-local migration fixtures`);
