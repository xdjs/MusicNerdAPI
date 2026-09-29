import { describe, it, expect } from "vitest";
import { decodeEntities } from "@/lib/pages/decodeEntities";

describe("decodeEntities", () => {
  it("decodes numeric, hex and named entities", () => {
    expect(
      decodeEntities("people&#8217;s &#x41; &amp; &lt;b&gt; &quot;q&quot; &apos;a&apos;"),
    ).toBe("people’s A & <b> \"q\" 'a'");
    expect(decodeEntities("a&nbsp;b&mdash;c&ndash;d&rsquo;&lsquo;&rdquo;&ldquo;&hellip;")).toBe(
      "a b—c–d''”“…",
    );
  });
});
