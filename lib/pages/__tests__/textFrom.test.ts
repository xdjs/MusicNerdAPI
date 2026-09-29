import { describe, it, expect } from "vitest";
import { textFrom } from "@/lib/pages/textFrom";

describe("textFrom", () => {
  it("strips chrome when asked, keeping paragraph breaks", () => {
    expect(textFrom("<nav>Home</nav><p>One.</p><p>Two.</p><!-- c -->", true)).toBe("One.\n\nTwo.");
  });

  it("keeps chrome text but still drops script and style when not stripping", () => {
    const out = textFrom(
      "<nav>Home</nav><script>x()</script><style>.a{}</style><p>One.</p>",
      false,
    );
    expect(out).toContain("Home");
    expect(out).toContain("One.");
    expect(out).not.toContain("x()");
    expect(out).not.toContain(".a{}");
  });
});
