import { it, expect } from "vitest";
import { parseScanReference } from "../parseScanReference";
const valid = {
  anchors: [{ id: "1", postedAt: "2026-10-01T00:00:00Z" }],
  observedAt: "2026-10-02T00:00:00Z",
  gapSince: null,
};
it("reads a bounded saved reference", () => expect(parseScanReference(valid)).toEqual(valid));
it.each([
  {},
  null,
  [],
  { ...valid, anchors: [{ id: "1", postedAt: "bad" }] },
  { ...valid, anchors: [{ id: "1", postedAt: "2026-11-01" }] },
  { ...valid, anchors: [...valid.anchors, ...valid.anchors] },
  { ...valid, gapSince: "bad" },
])("rejects malformed reference %j", value => expect(parseScanReference(value)).toBeUndefined());
