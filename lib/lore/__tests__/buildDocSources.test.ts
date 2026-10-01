import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ gatherDocMaterial: vi.fn(), toSourceList: vi.fn() }));
vi.mock("@/lib/lore/gatherDocMaterial", () => ({ gatherDocMaterial: m.gatherDocMaterial }));
vi.mock("@/lib/lore/toSourceList", () => ({ toSourceList: m.toSourceList }));
const { buildDocSources } = await import("@/lib/lore/buildDocSources");

describe("buildDocSources", () => {
  it("numbers the artist's current material without a model call", async () => {
    const material = { artistName: "N" };
    const sources = [{ id: 1, kind: "vault", label: "L", url: "u" }];
    m.gatherDocMaterial.mockResolvedValueOnce(material);
    m.toSourceList.mockReturnValueOnce(sources);
    expect(await buildDocSources("a1")).toBe(sources);
    expect(m.gatherDocMaterial).toHaveBeenCalledWith("a1");
    expect(m.toSourceList).toHaveBeenCalledWith(material);
  });
});
