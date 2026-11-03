import { expect, it, vi } from "vitest";
const remove = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/removeObjects", () => ({ removeObjects: remove }));
import { removeStagedUpload } from "../removeStagedUpload";
it("does not delete a potentially recreated staged key", async () => {
  await removeStagedUpload("artist/reused-key");
  expect(remove).not.toHaveBeenCalled();
});
