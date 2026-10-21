import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  claim: vi.fn(),
  canEdit: vi.fn(),
  submit: vi.fn(),
  extract: vi.fn(),
  user: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/users/getUserById", () => ({ getUserById: m.user }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEdit }));
vi.mock("@/lib/artistLinkReview/submitArtistDestination", () => ({
  submitArtistDestination: m.submit,
}));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId: m.extract }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink: m.set }));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink: m.clear }));
vi.mock("@/lib/directEditLink/notifyDiscordOfArtistLinkAdded", () => ({
  notifyDiscordOfArtistLinkAdded: m.notify,
}));
const { postDirectEditLinkHandler } =
  await import("@/lib/directEditLink/postDirectEditLinkHandler");

const artistId = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const post = (body: unknown) =>
  postDirectEditLinkHandler(
    new Request("https://api.test/api/directEditLink", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
const set = (url: string) => post({ artistId, action: "set", url });
const igUrl = "https://www.instagram.com/p3t3rango/";

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.claim.mockResolvedValue({ id: "c1" });
  m.canEdit.mockResolvedValue(true);
  m.extract.mockResolvedValue({
    siteName: "instagram",
    cardPlatformName: "Instagram",
    id: "p3t3rango",
  });
  m.user.mockResolvedValue({ username: "Pete", wallet: null });
  m.set.mockResolvedValue({ oldValue: "old", artistName: "Pete Rango" });
  m.clear.mockResolvedValue({ oldValue: "old" });
});

describe("postDirectEditLinkHandler set", () => {
  it("writes the urlmap platform under the claimant's operation, recording the self-edit URL", async () => {
    let scope: unknown;
    m.set.mockImplementation(async () => {
      scope = getArtistOperationOwnership(artistId);
      return { oldValue: "old", artistName: "Pete Rango" };
    });
    const res = await set(igUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      success: true,
      siteName: "instagram",
      platformName: "Instagram",
    });
    expect(m.set).toHaveBeenCalledWith(artistId, "instagram", "p3t3rango", igUrl);
    expect(m.user).toHaveBeenCalledWith("u1");
    expect(scope).toEqual({ artistId, userId: "u1", expectedClaimId: "c1" });
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.canEdit.mock.invocationCallOrder[0]);
    expect(m.notify).toHaveBeenCalledWith({
      user: { username: "Pete", wallet: null },
      artistName: "Pete Rango",
      platformName: "Instagram",
      platformId: "p3t3rango",
      submittedUrl: igUrl,
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("does not notify on a save of the same value", async () => {
    m.set.mockResolvedValue({ oldValue: "p3t3rango", artistName: "Pete Rango" });
    expect((await set(igUrl)).status).toBe(200);
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("falls back to the artist id, the site name and an empty user in the notification", async () => {
    m.extract.mockResolvedValue({ siteName: "instagram", cardPlatformName: null, id: "p" });
    m.user.mockResolvedValue(undefined);
    m.set.mockResolvedValue({ oldValue: null, artistName: null });
    await set(igUrl);
    expect(m.notify).toHaveBeenCalledWith(
      expect.objectContaining({ user: {}, artistName: artistId, platformName: "instagram" }),
    );
  });

  it("refuses a song or album, and a URL no platform reads", async () => {
    const release = await set("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy");
    expect(release.status).toBe(400);
    expect(await release.json()).toEqual({
      status: "error",
      error: "Add an artist profile link, not a song or album.",
    });
    m.extract.mockResolvedValue(null);
    const unknown = await set("https://unknown.test/pete");
    expect(unknown.status).toBe(400);
    expect(((await unknown.json()) as { error: string }).error).toBe(
      'We don\'t support that link yet — we currently accept links from a fixed set of platforms. Check the "Supported links" list to see them.',
    );
    expect(m.set).not.toHaveBeenCalled();
  });

  it("files an Apple Music or Beatport artist page as an approved Lore source", async () => {
    m.submit.mockResolvedValue({ id: "s1", platform: "applemusic", label: "Apple Music" });
    const url = "https://music.apple.com/us/artist/pete-rango/123";
    const res = await set(url);
    expect(await res.json()).toEqual({
      status: "ok",
      success: true,
      siteName: "applemusic",
      platformName: "Apple Music",
    });
    expect(m.submit).toHaveBeenCalledWith(artistId, "u1", url, "c1", true);
    expect(m.set).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("400s a set without a url, after the authorization check", async () => {
    const res = await post({ artistId, action: "set" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "url is required for set action" });
    m.canEdit.mockResolvedValue(false);
    expect((await post({ artistId, action: "set" })).status).toBe(403);
  });
});

describe("postDirectEditLinkHandler clear", () => {
  it("clears the column under the operation", async () => {
    let scope: unknown;
    m.clear.mockImplementation(async () => {
      scope = getArtistOperationOwnership(artistId);
      return { oldValue: "x" };
    });
    const res = await post({ artistId, action: "clear", siteName: "instagram" });
    expect(await res.json()).toEqual({ status: "ok", success: true });
    expect(m.clear).toHaveBeenCalledWith(artistId, "instagram");
    expect(scope).toEqual({ artistId, userId: "u1", expectedClaimId: "c1" });
  });

  it("400s a clear without a siteName", async () => {
    const res = await post({ artistId, action: "clear" });
    expect(await res.json()).toEqual({
      status: "error",
      error: "siteName is required for clear action",
    });
  });
});

describe("postDirectEditLinkHandler errors", () => {
  it("passes 401 through, 400s a bad body and 403s a non-owner", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await set(igUrl)).status).toBe(401);
    expect((await post({ action: "set" })).status).toBe(400);
    m.canEdit.mockResolvedValue(false);
    const res = await set(igUrl);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Not authorized for this artist" });
  });

  it("maps a changed claim to 403, a conflict to 409 CONFLICT and anything else to 500", async () => {
    m.set.mockRejectedValueOnce(new OwnershipChangedError());
    const changed = await set(igUrl);
    expect(changed.status).toBe(403);
    expect(await changed.json()).toEqual({
      status: "error",
      error: "Artist ownership changed; this operation was cancelled.",
    });
    m.set.mockRejectedValueOnce(
      new ArtistLinkConflictError("That spotify artist ID is already linked to a different artist"),
    );
    const conflict = await set(igUrl);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      status: "error",
      error: "That spotify artist ID is already linked to a different artist",
      code: "CONFLICT",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.set.mockRejectedValueOnce(new Error("db"));
    const failed = await set(igUrl);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(failed.headers.get("Access-Control-Allow-Origin")).toBe("*");
    log.mockRestore();
  });
  it("answers a JSON 500 with CORS when signing in throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.auth.mockRejectedValueOnce(new Error("db down"));
    const res = await post({ artistId, action: "clear", siteName: "instagram" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    log.mockRestore();
  });
});
