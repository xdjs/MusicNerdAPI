import { expect, it, vi } from "vitest";
import { catalogLinkWasDisconnected } from "../catalogLinkWasDisconnected";

it("returns the database's boolean disconnect decision", async () => {
  const execute = vi
    .fn()
    .mockResolvedValueOnce([{ blocked: true }])
    .mockResolvedValueOnce([{ blocked: false }]);
  expect(await catalogLinkWasDisconnected({ execute } as never, "artist", "deezer")).toBe(true);
  expect(await catalogLinkWasDisconnected({ execute } as never, "artist", "spotify")).toBe(false);
});

it("fails closed when the migration is missing or its result is malformed", async () => {
  const execute = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("missing function"));
  await expect(
    catalogLinkWasDisconnected({ execute } as never, "artist", "deezer"),
  ).rejects.toThrow("guard unavailable");
  await expect(
    catalogLinkWasDisconnected({ execute } as never, "artist", "deezer"),
  ).rejects.toThrow("missing function");
});
