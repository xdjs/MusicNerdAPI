import { describe, it, expect } from "vitest";
import { reelAudioCandidates } from "@/lib/questions/reelAudioCandidates";
import { post } from "@/lib/socialSignals/__tests__/post";

describe("reel audio interview material", () => {
  it("offers bounded, cited audio without treating the speaker as the artist", () => {
    const posts = [
      post({
        url: "https://www.instagram.com/p/AUDIO1/",
        transcript: "I layer the bass after the drums.",
      }),
    ];
    const [candidate] = reelAudioCandidates(posts, "Artist");
    expect(candidate).toMatchObject({
      key: "social_audio_AUDIO1",
      kind: "audio",
      authoredBy: "speaker unverified",
      sourceUrls: [posts[0].url],
    });
    expect(candidate.material).toContain("speaker is unverified");
    expect(candidate.material).toContain(posts[0].transcript);
    expect(
      reelAudioCandidates(
        [
          post({ isOwnPost: false, transcript: "guest" }),
          post({ platform: "tiktok", transcript: "video" }),
        ],
        "Artist",
      ),
    ).toEqual([]);
  });
});
