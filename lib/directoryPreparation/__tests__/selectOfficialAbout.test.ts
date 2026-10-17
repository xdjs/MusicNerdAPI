import { expect, it, vi } from "vitest";
import { selectOfficialAbout } from "../selectOfficialAbout";
const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/lib/vault/resolveOutboundHandles", () => ({ resolveOutboundHandles: mocks.resolve }));
const bio =
  "Xcelencia is an independent recording artist who produces electronic music and performs with a live ensemble.";
const material = {
  artistName: "Xcelencia",
  startingBio: null,
  accounts: { soundcloud: "xcelencia" },
  manifest: [
    {
      id: "s",
      artistId: "a",
      title: "Profile",
      url: "https://soundcloud.com/xcelencia",
      extractedText: `Navigation\n\nBiography\n${bio}\n\nPopular tracks`,
      publishedAt: null,
      status: "pending",
    },
  ],
};
it("copies only an exact labeled biography from the matched artist account", async () => {
  mocks.resolve.mockResolvedValue([{ siteName: "soundcloud", id: "xcelencia" }]);
  expect(await selectOfficialAbout(material)).toEqual({
    version: 1,
    identity: { name: "Xcelencia", accounts: { soundcloud: "xcelencia" } },
    bio,
    kind: "official",
    sources: [{ id: "s", url: material.manifest[0].url, label: "Profile" }],
    ownership: { siteName: "soundcloud", id: "xcelencia" },
  });
});
it("rejects namesakes, outbound references, heuristic domains and unlabeled text", async () => {
  for (const handles of [
    [],
    [{ siteName: "soundcloud", id: "other" }],
    [{ siteName: "soundcloud", id: "xcelencia", corroborationOnly: true }],
  ]) {
    mocks.resolve.mockResolvedValue(handles);
    expect(await selectOfficialAbout(material)).toBeNull();
  }
  mocks.resolve.mockResolvedValue([{ siteName: "soundcloud", id: "xcelencia" }]);
  expect(
    await selectOfficialAbout({
      ...material,
      manifest: [{ ...material.manifest[0], extractedText: bio }],
    }),
  ).toBeNull();
});
it("does not treat a track or post under an account as its profile biography", async () => {
  mocks.resolve.mockResolvedValue([{ siteName: "soundcloud", id: "xcelencia" }]);
  expect(
    await selectOfficialAbout({
      ...material,
      manifest: [{ ...material.manifest[0], url: "https://soundcloud.com/xcelencia/track" }],
    }),
  ).toBeNull();
});
it("falls back when a biography is missing, too long or its saved account changed", async () => {
  mocks.resolve.mockResolvedValue([{ siteName: "soundcloud", id: "xcelencia" }]);
  expect(
    await selectOfficialAbout({ ...material, accounts: { soundcloud: "new-account" } }),
  ).toBeNull();
  expect(
    await selectOfficialAbout({
      ...material,
      manifest: [{ ...material.manifest[0], extractedText: `Bio\n${"long ".repeat(400)}` }],
    }),
  ).toBeNull();
});
it("does not trust a lookalike host even if a loose stored URL pattern resolves it", async () => {
  mocks.resolve.mockResolvedValue([{ siteName: "soundcloud", id: "xcelencia" }]);
  expect(
    await selectOfficialAbout({
      ...material,
      manifest: [
        { ...material.manifest[0], url: "https://soundcloud.com.attacker.example/xcelencia" },
      ],
    }),
  ).toBeNull();
});
