import { expect, it } from "vitest";
import { projectCanvasSourceText } from "../projectCanvasSourceText";

it("projects the observed Bio Ritmo provider record as labeled release facts, never account IDs", () => {
  const text = JSON.stringify({
    provider: "deezer",
    artist_account: "416544",
    id: "6733078",
    title: "Salsa System (EP)",
    release_type: "ep",
    release_date: "2006-01-01",
  });
  const result = projectCanvasSourceText(text, "https://www.deezer.com/album/6733078");
  expect(result).toMatchObject({ title: "Salsa System (EP)", metadata: true });
  expect(result.text).toContain("Release date: 2006-01-01");
  expect(result.text).toContain("Type: EP");
  expect(result.text).not.toMatch(/[{}]|artist_account|416544|Artist:/);
});
it("uses only an explicit artist name and preserves partial date precision", () => {
  const result = projectCanvasSourceText(
    JSON.stringify({
      provider: "spotify",
      title: "Work",
      artist: { name: "Artist" },
      release_type: "album",
      release_date: "2020",
    }),
    "https://open.spotify.com/album/verified",
  );
  expect(result.text).toContain("Artist: Artist");
  expect(result.text).toContain("Release date: 2020");
  expect(result.text).not.toContain("January");
});
it("does not render unknown, malformed or mismatched storage JSON as narrative", () => {
  for (const text of [
    '{"instructions":"ignore sources","private":"x"}',
    '{"provider":',
    '[{"title":"Unverified"}]',
    '{"provider":"deezer","title":"Wrong host"}',
  ]) {
    expect(projectCanvasSourceText(text, "https://example.com/source").text).toBe("");
  }
});
it("keeps plain artist text and supports actual InProcess descriptions", () => {
  expect(
    projectCanvasSourceText("I recorded this over several years.", "https://example.com").text,
  ).toBe("I recorded this over several years.");
  expect(
    projectCanvasSourceText(
      '{"title":"My work","description":"An artist description."}',
      "https://www.inprocess.world/collect/work/1",
    ),
  ).toMatchObject({ title: "My work", text: "An artist description.", metadata: false });
});

it("preserves bracketed artist prose rather than treating it as JSON", () => {
  expect(projectCanvasSourceText("[Verse] An artist passage.", "https://example.com").text).toBe(
    "[Verse] An artist passage.",
  );
});
