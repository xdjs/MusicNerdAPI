import { expect, it, vi } from "vitest";
import { removeStagedUpload } from "../removeStagedUpload";
const remove = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/removeObjects", () => ({ removeObjects: remove }));
it("does not delete a potentially recreated staged key", async () => {
  await removeStagedUpload("artist/reused-key");
  expect(remove).not.toHaveBeenCalled();
});
