import { describe, it, expect, vi, beforeEach } from "vitest";

const { storageRequest } = vi.hoisted(() => ({ storageRequest: vi.fn() }));
vi.mock("@/lib/artistImages/storageRequest", () => ({ storageRequest }));
const { removeProfileImages } = await import("@/lib/artistImages/removeProfileImages");

beforeEach(() => {
  storageRequest.mockReset();
});

describe("removeProfileImages", () => {
  it("DELETEs the given object paths from the vault bucket", async () => {
    storageRequest.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    await removeProfileImages(["profile-images/a_1.png", "profile-images/a_2.png"]);
    const [path, init] = storageRequest.mock.calls[0];
    expect(path).toBe("object/vault-files");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({
      prefixes: ["profile-images/a_1.png", "profile-images/a_2.png"],
    });
  });

  it("throws when storage refuses", async () => {
    storageRequest.mockResolvedValueOnce(new Response("", { status: 403 }));
    await expect(removeProfileImages(["profile-images/a_1.png"])).rejects.toThrow(
      "Storage remove failed: HTTP 403",
    );
  });
});
