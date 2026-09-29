import { describe, it, expect } from "vitest";
import { extractPodcastEpisodeIdentity } from "@/lib/pages/extractPodcastEpisodeIdentity";

const apple = "https://podcasts.apple.com/tw/podcast/episode/id1877956390?i=1000780276007&l=en-GB";
const iheart = "https://www.iheart.com/podcast/269-the-hook-323320053/episode/episode-340460192/";
const media = "https://www.buzzsprout.com/2596593/episodes/19605095-episode.mp3";

describe("extractPodcastEpisodeIdentity", () => {
  it("extracts the same recording from Apple and iHeart, regardless of media tracking", () => {
    const appleHtml = `<meta property="og:title" content="Episode"><script>{"partOfSeries":{"name":"The Hook"},"guid":"Buzzsprout-19605095","feedUrl":"https://rss.buzzsprout.com/2596593.rss","streamUrl":"${media}"}</script>`;
    const iheartHtml = `<meta content="Episode  The Hook | iHeart" property="og:title"><script>"mediaUrl","${media}?source=iheart"</script>`;
    expect(extractPodcastEpisodeIdentity(apple, appleHtml)).toEqual({
      podcastEpisodeKey: "buzzsprout:2596593:19605095",
      podcastShowTitle: "The Hook",
      podcastEpisodeTitle: "Episode",
    });
    expect(extractPodcastEpisodeIdentity(iheart, iheartHtml)?.podcastEpisodeKey).toBe(
      "buzzsprout:2596593:19605095",
    );
  });

  it("leaves ambiguous, unrelated, or non-episode pages ungrouped", () => {
    const two = `${media} https://www.buzzsprout.com/2596593/episodes/19605096-next.mp3`;
    expect(extractPodcastEpisodeIdentity(apple, two)).toBeNull();
    expect(
      extractPodcastEpisodeIdentity(
        apple,
        `"guid":"Buzzsprout-19605096","feedUrl":"https://rss.buzzsprout.com/2596593.rss","streamUrl":"${media}"`,
      ),
    ).toBeNull();
    expect(extractPodcastEpisodeIdentity(apple.replace("?i=1000780276007", ""), media)).toBeNull();
    expect(extractPodcastEpisodeIdentity("https://example.org/episode", media)).toBeNull();
    expect(extractPodcastEpisodeIdentity("not a url", media)).toBeNull();
  });

  it("keeps apostrophes in an episode's og:title attribute", () => {
    const html = `<meta content="Artist's Story  The Show | iHeart" property="og:title"><script>"mediaUrl","${media}"</script>`;
    expect(extractPodcastEpisodeIdentity(iheart, html)?.podcastEpisodeTitle).toBe("Artist's Story");
  });
});
